/** @typedef {[datestring:string, number]} DataPoint */
/** @typedef {{[date:string]:number}} Segment */
/** @typedef {Segment[]} AllSegments */

async function addButtons() {
  // The URL looks like this: https://partner.steampowered.com/app/wishlist/1401730 (followed by a bunch of query params)

  // Get the game's steamId from the URL
  const steamId = window.location.pathname.split('/')[2];

  // Steam creates a custom script per application + query params that contains
  // the data we need. So we need to extract it out of the script tags.
  chartToTsvButton(
    document.querySelectorAll('body script')[4]?.innerHTML,
    [
      'Wishlist Adds',
      'Wishlist Deletes',
      'Wishlist Purchases & Activations',
      'Wishlist Gifts',
    ],
    'actions_graph',
    document.querySelectorAll('h2')[3],
  );

  chartToTsvButton(
    document.querySelectorAll('body script')[5]?.innerHTML,
    [
      'Total Additions',
      'Total Deletions',
      'Total Purchases & Activations',
      'Total Gifts',
      'Outstanding Wishes',
    ],
    'lifetime_running_total_graph',
    document.querySelectorAll('h2')[5],
  );
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
 * @param {string|undefined} scriptText
 * @param {string[]} segmentTitles
 * @param {string} chartId
 * @param {HTMLElement} afterEl
 */
function chartToTsvButton(scriptText, segmentTitles, chartId, afterEl) {
  assert(scriptText, 'Could not find script tag');

  const segments = extractSegments(scriptText, chartId);

  // Create a TSV download, with each segment as a column
  const rows = [['Date', ...segmentTitles].join('\t')];
  const allDates = datesFromSegments(segments);

  console.log({ segments, allDates });

  for (const date of allDates) {
    const viewRow = segments.map((s) => s[date] ?? 0);
    rows.push([date, ...viewRow].join('\t'));
  }

  const asTsv = rows.join('\n');

  // Add it to the DOM after the heading
  const containerId = `stitch-copy-container-${chartId}`;
  const hiddenContainerId = `stitch-copy-hidden-container-${chartId}`;

  assert(afterEl, `Could not find heading for ${chartId}`);
  const copyAsTsv = `navigator.clipboard.writeText(document.querySelector('#${hiddenContainerId}').value)`;

  const copyEl = document.createElement('div');
  copyEl.id = containerId;
  copyEl.innerHTML =
    '<a href="https://bscotch.github.io/stitch/steam-tools" target="_blank" style="color:yellow;">Stitch</a>: <button onclick="' +
    copyAsTsv +
    '">Copy TSV</button>';
  copyEl.style = 'margin-bottom:0.5em; font-size: 1.1rem; font-weight:bold;';
  // Add hidden child to the copyEl to contain the TSV data
  const hiddenEl = document.createElement('textarea');
  hiddenEl.id = hiddenContainerId;
  hiddenEl.style = 'display:none;';
  hiddenEl.value = asTsv;
  copyEl.appendChild(hiddenEl);

  const existing = document.querySelector(`#${containerId}`);
  if (existing) {
    existing.remove();
  }
  // Insert after the h3
  afterEl.parentNode.insertBefore(copyEl, afterEl.nextSibling);
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
 * @param {string} scriptText
 * @param {string} key
 * @returns {AllSegments}
 */
function extractSegments(scriptText, key) {
  const pattern = new RegExp(`['"]${key}['"][^[]+([^{]+)`);
  let match = scriptText.match(pattern)?.[1]?.trim();
  assert(match, `Could not find ${key}`);
  if (match.at(-1) === ',') match = match.slice(0, -1);
  const array = extractedArrayStringToArray(match);

  return array.map((segment) => {
    return segment.reduce((acc, [date, value]) => {
      acc[date] = value;
      return acc;
    }, {});
  });
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
  console.log(cleaned);
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
