/** @typedef {[datestring:string, number]} DataPoint */
/** @typedef {{[date:string]:number}} Segment */
/** @typedef {Segment[]} AllSegments */

async function addButtons() {
  // The URL looks like this: https://partner.steamgames.com/apps/navtrafficstats/1401730 (followed by a bunch of query params)

  // Get the game's steamId from the URL
  const steamId = window.location.pathname.split('/')[2];

  // Steam creates a custom script per application + query params that contains
  // the data we need. So we need to extract it out of the script tag.
  const scriptText = document.querySelector(
    'head > script:last-of-type',
  )?.innerHTML;
  assert(scriptText, 'Could not find script tag');

  const viewSegments = extractSegments(
    defined(scriptText.match(/var dataViews = ([^;]+)/))[1],
  );

  const impressionSegments = extractSegments(
    defined(scriptText.match(/var dataImpressions = ([^;]+)/))[1],
  );

  // Each root-level array in these arrays is for a particular segment of
  // data (e.g. "Total", ...). We can extract these out as well. Note that
  // in the source data they overwrite the viewsRaw segment titles with the
  // impressionsRaw segment titles, so we can just extract both times that
  // value is set and use them in order.
  const [viewsTitlesString, impressionsTitlesString] = defined(
    scriptText.match(/options\[['"]series['"]\] = ([^;]+)/gm),
  );

  /** @typedef {{label:string}} SegmentTitle */

  const viewSegmentTitles = /** @type {SegmentTitle[]} */ (
    extractedArrayStringToArray(
      defined(
        viewsTitlesString.match(/options\[['"]series['"]\] = ([^;]+)/),
      )[1],
    )
  ).map((t) => t.label);

  const impressionSegmentTitles = /** @type {SegmentTitle[]} */ (
    extractedArrayStringToArray(
      defined(
        impressionsTitlesString.match(/options\[['"]series['"]\] = ([^;]+)/),
      )[1],
    )
  ).map((t) => t.label);

  // Create a TSV download, with each segment as a column
  const rows = [
    [
      'Date',
      ...viewSegmentTitles.map((t) => `${t} Views`),
      ...impressionSegmentTitles.map((t) => `${t} Impressions`),
    ].join('\t'),
  ];

  // Get the range of dates from the segments
  const allDates = datesFromSegments([...viewSegments, ...impressionSegments]);

  for (const date of allDates) {
    const viewRow = viewSegments.map((s) => s[date] ?? 0);
    const impressionRow = impressionSegments.map((s) => s[date] ?? 0);
    rows.push([date, ...viewRow, ...impressionRow].join('\t'));
  }

  const asTsv = rows.join('\n');

  // Add it to the DOM. The first h3 is for the "Visits over time" section,
  // so putting a button right after there makes sense.
  const h3 = document.querySelector('h3');
  assert(h3, 'Could not find h3');
  const copyAsTsv =
    "navigator.clipboard.writeText(document.querySelector('#stitch-copy-hidden').value)";

  const copyEl = document.createElement('div');
  copyEl.id = 'stitch-copy-container';
  copyEl.innerHTML =
    '<a href="https://bscotch.github.io/stitch/steam-tools" target="_blank" style="color:yellow;">Stitch</a>: <button onclick="' +
    copyAsTsv +
    '">Copy TSV</button>';
  copyEl.style = 'margin-bottom:0.5em; font-size: 1.1rem; font-weight:bold;';
  // Add hidden child to the copyEl to contain the TSV data
  const hiddenEl = document.createElement('textarea');
  hiddenEl.id = 'stitch-copy-hidden';
  hiddenEl.style = 'display:none;';
  hiddenEl.value = asTsv;
  copyEl.appendChild(hiddenEl);

  const existing = document.querySelector('#stitch-copy-container');
  if (existing) {
    existing.remove();
  }
  // Insert after the h3
  h3.parentNode.insertBefore(copyEl, h3.nextSibling);
}

/**
 * @param {any} claim
 * @param {string} msg
 * @returns {asserts claim}
 */
function assert(claim, msg) {
  if (!claim) {
    throw new Error(msg);
  }
}

/**
 * Get the range of valid dates from segments, ensuring all
 * dates are present (some can be missing in the data).
 * @param {AllSegments} segments
 */
function datesFromSegments(segments) {
  /** @type {Set<string>} */
  const dates = new Set();
  for (const segment of segments) {
    for (const date of Object.keys(segment)) {
      dates.add(date);
    }
  }
  const sorted = [...dates].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );
  const range = [sorted[0], sorted[sorted.length - 1]];
  // Return an array that starts with the first date in the range and
  // adds one day at a time until we reach the last date in the range.
  const allDates = [];
  let current = new Date(range[0]);
  const end = new Date(range[1]);
  while (current <= end) {
    allDates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return allDates;
}

/**
 * @param {string} arrString
 * @returns {AllSegments}
 */
function extractSegments(arrString) {
  /** @type {DataPoint[][]} */
  const array = extractedArrayStringToArray(arrString);
  /** @type {AllSegments} */
  const segments = [];
  for (const segment of array) {
    /** @type {Segment} */
    const segmentData = {};
    for (const [date, value] of segment) {
      segmentData[date] = value;
    }
    segments.push(segmentData);
  }
  return segments;
}

/**
 * @param {string} arrString
 * @returns {any[]}
 */
function extractedArrayStringToArray(arrString) {
  const cleaned = arrString
    .replace(/'/g, '"')
    .replace(/\s/g, '')
    .replace(/,([}\]])/g, '$1')
    .replace(/(\w+):/g, '"$1":');
  return JSON.parse(cleaned);
}

/**
 * @template T
 * @param {T} val
 * @returns {Exclude<T, undefined | null>}
 */
function defined(val) {
  assert(val !== undefined, 'Value is undefined');
  return val;
}

addButtons();
