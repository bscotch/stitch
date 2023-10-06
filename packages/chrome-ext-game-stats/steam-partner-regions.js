/**
 * @typedef SteamRegion
 * @prop {string} name
 * @prop {{total:number, steam:number, ingame:number}} revenue
 * @prop {{total:number, steam:number, retail:number}} units
 * @prop {{total:number}} wishlists
 *
 * @typedef SteamTable
 * @prop {string} name
 * @prop {SteamRegion[]} regions
 */

const steamCountries = {
  Argentina: [{ name: 'Spanish-Latin America', percent: 100 }],
  Australia: [{ name: 'English', percent: 72 }],
  Austria: [{ name: 'German', percent: 88.6 }],
  Azerbaijan: [{ name: 'Azerbaijani', percent: 92.5 }],
  Belarus: [
    { name: 'Russian', percent: 71.4 },
    { name: 'Belarusian', percent: 26 },
  ],
  Belgium: [
    { name: 'Dutch', percent: 60 },
    { name: 'French', percent: 40 },
  ],
  Brazil: [{ name: 'Portuguese', percent: 100 }],
  'Brunei Darussalam': [{ name: 'Malay', percent: 100 }],
  Bulgaria: [{ name: 'Bulgarian', percent: 76.8 }],
  Canada: [
    { name: 'English', percent: 87.1 },
    { name: 'French', percent: 29.1 },
  ],
  'Cayman Islands': [{ name: 'English', percent: 90.9 }],
  Chile: [
    { name: 'Spanish-Latin America', percent: 99.5 },
    { name: 'English', percent: 10.2 },
  ],
  China: [{ name: 'Chinese (Simplified)', percent: 100 }],
  Colombia: [{ name: 'Spanish-Latin America', percent: 100 }],
  'Costa Rica': [{ name: 'Spanish-Latin America', percent: 100 }],
  'Czech Republic': [{ name: 'Czech', percent: 88.4 }],
  Denmark: [{ name: 'Danish', percent: 100 }],
  'El Salvador': [{ name: 'Spanish-Latin America', percent: 100 }],
  Finland: [{ name: 'Finnish', percent: 86.5 }],
  France: [{ name: 'French', percent: 100 }],
  Germany: [{ name: 'German', percent: 100 }],
  Guatemala: [{ name: 'Spanish-Latin America', percent: 69.9 }],
  'Hong Kong': [{ name: 'Chinese (Traditional)', percent: 88.9 }],
  Hungary: [
    { name: 'Hungarian', percent: 99.6 },
    { name: 'English', percent: 16 },
    { name: 'German', percent: 11.2 },
  ],
  India: [{ name: 'Hindi', percent: 43.6 }],
  Indonesia: [{ name: 'English', percent: 100 }],
  Ireland: [{ name: 'English', percent: 100 }],
  Italy: [{ name: 'Italian', percent: 100 }],
  Japan: [{ name: 'Japanese', percent: 100 }],
  Jordan: [{ name: 'Arabic', percent: 100 }],
  Kazakhstan: [{ name: 'Kazakh', percent: 83.1 }],
  'Korea, Republic of': [{ name: 'Korean', percent: 100 }],
  Kuwait: [{ name: 'Arabic', percent: 100 }],
  Latvia: [
    { name: 'Latvian', percent: 56.3 },
    { name: 'Russian', percent: 33.8 },
  ],
  Lithuania: [{ name: 'Lithuanian', percent: 85.3 }],
  Malaysia: [{ name: 'Malay', percent: 100 }],
  Mexico: [{ name: 'Spanish-Latin America', percent: 93.8 }],
  Netherlands: [{ name: 'Dutch', percent: 100 }],
  'New Zealand': [{ name: 'English', percent: 95.4 }],
  Norway: [{ name: 'Norwegian', percent: 100 }],
  Panama: [{ name: 'Spanish-Latin America', percent: 100 }],
  Peru: [
    { name: 'Spanish-Latin America', percent: 82.9 },
    { name: 'Quechua', percent: 13.6 },
  ],
  Philippines: [{ name: 'Filipino', percent: 100 }],
  Poland: [{ name: 'Polish', percent: 98.2 }],
  Portugal: [{ name: 'Portuguese', percent: 100 }],
  Romania: [{ name: 'Romanian', percent: 91.6 }],
  'Russian Federation': [{ name: 'Russian', percent: 85.7 }],
  Singapore: [
    { name: 'English', percent: 48.3 },
    { name: 'Chinese (Simplified)', percent: 29.9 },
  ],
  'Slovakia (Slovak Republic)': [{ name: 'Slovak', percent: 81.8 }],
  Slovenia: [{ name: 'Slovenian', percent: 87.7 }],
  'South Africa': [
    { name: 'Zulu', percent: 25.3 },
    { name: 'Xhosa', percent: 14.8 },
    { name: 'Afrikaans', percent: 12.2 },
  ],
  Spain: [
    { name: 'Spanish-Spain', percent: 74 },
    { name: 'Catalan', percent: 17 },
  ],
  Sweden: [{ name: 'Swedish', percent: 100 }],
  Taiwan: [{ name: 'Chinese (Simplified)', percent: 100 }],
  Thailand: [{ name: 'Thai', percent: 90.7 }],
  Turkey: [{ name: 'Turkish', percent: 100 }],
  Ukraine: [
    { name: 'Ukrainian', percent: 67.5 },
    { name: 'Russian', percent: 29.6 },
  ],
  'United Arab Emirates': [{ name: 'Arabic', percent: 100 }],
  'United Kingdom': [{ name: 'English', percent: 100 }],
  'United States': [
    { name: 'English', percent: 78.2 },
    { name: 'Spanish-Latin America', percent: 13.4 },
  ],
  Uruguay: [{ name: 'Spanish-Latin America', percent: 100 }],
  'Viet Nam': [{ name: 'Vietnamese', percent: 100 }],
};

function addButtons() {
  // Unfortunately the whole thing is just one big table 💀
  /** @type {HTMLTableRowElement[]} */
  const rows = Array.from(document.querySelectorAll('table.grouping_table tr'));

  /** @type {SteamTable[]} */
  const tables = [];

  /** @type {SteamTable|undefined} */
  let currentTable;
  /** @type {SteamRegion|undefined} */
  let currentRegion;

  for (const row of rows) {
    if (!row.classList?.length) {
      // Then this is a header row for a table. Which table is it?
      const name = row.querySelector('th')?.innerHTML;
      if (!name) continue;
      currentTable = { name, regions: [] };
      tables.push(currentTable);
      continue;
    }
    if (!currentTable) continue;

    // If there's an EXPAND image in the first <td>,
    // this this is a new region/country section.
    const hasExpand = row.querySelector('td:first-child img');
    if (hasExpand) {
      const regionName = row.querySelector('td:nth-child(2) a')?.innerHTML;
      if (!regionName) continue;
      currentRegion = {
        name: regionName,
        revenue: { total: 0, steam: 0, ingame: 0 },
        units: { total: 0, steam: 0, retail: 0 },
        wishlists: { total: 0 },
      };
      currentTable.regions.push(currentRegion);
    }
    if (!currentRegion) continue;

    // The 4th <td> contains the tally category/type
    const tallyRowName = row
      .querySelector('td:nth-child(4)')
      ?.innerHTML.toLowerCase()
      .replace(/&nbsp;/g, '')
      .replace(/<a.*/, '');
    if (!tallyRowName) continue;

    const tallyCategory = tallyRowName.match(/unit|activation/)
      ? 'units'
      : tallyRowName.match(/revenue|sales/)
      ? 'revenue'
      : tallyRowName.match(/wishlist/)
      ? 'wishlists'
      : null;

    if (!tallyCategory) {
      console.error('Unknown tally type', tallyRowName);
      continue;
    }

    const tallyType = ['revenue', 'units', 'wishlist balance'].includes(
      tallyRowName,
    )
      ? 'total'
      : tallyRowName.match(/steam/)
      ? 'steam'
      : tallyRowName.match(/in-game/)
      ? 'ingame'
      : tallyRowName.match(/retail/)
      ? 'retail'
      : null;

    if (!tallyType) {
      console.error('Unknown tally type', tallyRowName);
      continue;
    }

    let valueString = row
      .querySelector('td:nth-child(5)')
      ?.innerHTML.replace(/[$\\s,]/g, '');
    if (!valueString) continue;

    if (valueString.startsWith('(')) {
      valueString = '-' + valueString.replace(/[()]/g, '');
    }
    const value = +valueString;
    if (isNaN(value)) {
      console.error(
        'Unknown value',
        row.querySelector('td:nth-child(5)')?.innerHTML,
      );
      continue;
    }

    currentRegion[tallyCategory][tallyType] = value;
  }

  // Create a CSV combining all tables, with headers:
  // Table, Region, revenue (total), revenue (steam), ...
  const csv = [
    [
      'Table',
      'Region',
      'Wishlists (total)',
      'Revenue (total)',
      'Revenue (steam)',
      'Revenue (in-game)',
      'Units (total)',
      'Units (steam)',
      'Units (retail)',
    ].join(','),
    ...tables.flatMap((table) =>
      table.regions.map((region) =>
        [
          table.name.replace(/,/g, ';'),
          region.name.replace(/,/g, ';'),
          region.wishlists.total,
          region.revenue.total,
          region.revenue.steam,
          region.revenue.ingame,
          region.units.total,
          region.units.steam,
          region.units.retail,
        ].join(','),
      ),
    ),
  ].join('\\n');

  const asJson = JSON.stringify(tables).replace(/"/g, '&quot;');

  // Insert buttons above the table to copy as CSV and as JSON
  const copyAsCsv = "navigator.clipboard.writeText('" + csv + "')";
  const copyAsTsv =
    "navigator.clipboard.writeText('" + csv.replace(/,/g, '\\t') + "')";
  const copyAsJson = "navigator.clipboard.writeText('" + asJson + "')";

  const copyEl = document.createElement('div');
  copyEl.id = 'stitch-copy-container';
  copyEl.innerHTML =
    '<a href="https://bscotch.github.io/stitch/steam-tools" target="_blank" style="color:yellow;">Stitch</a>: <button onclick="' +
    copyAsCsv +
    '">Copy CSV</button> <button onclick="' +
    copyAsTsv +
    '">Copy TSV</button>  <button onclick="' +
    copyAsJson +
    '">Copy JSON</button>';
  copyEl.style = 'margin-bottom:0.5em; font-size: 1.1rem; font-weight:bold;';

  const existing = document.querySelector('#stitch-copy-container');
  if (existing) {
    existing.remove();
  }
  const table = document.querySelector('table.grouping_table');
  table?.parentNode?.insertBefore(copyEl, table);
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

addButtons();
