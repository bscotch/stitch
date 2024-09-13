const steamRegionsIife = /* js */ `(async function(){
  if (window.location.host !== 'partner.steampowered.com' || !window.location.pathname.startsWith('/region') ) {
    console.error('The Stitch:SteamRegions bookmarklet only works on https://partner.steampowered.com/region')
    return;
  }

  // Unfortunately the whole thing is just one big table 💀
  /** @type {HTMLTableRowElement[]} */
  const rows = Array.from(document.querySelectorAll('table.grouping_table tr'));

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

  /** @type {SteamTable[]} */
  const tables = [];

  /** @type {SteamTable} */
  let currentTable;
  /** @type {SteamRegion} */
  let currentRegion;

  for(const row of rows){
    if(!row.classList?.length){
      // Then this is a header row for a table. Which table is it?
      const name = row.querySelector('th').innerHTML;
      currentTable = { name, regions:[] };
      tables.push(currentTable);
      continue;
    }
    if(!currentTable) continue;

    // If there's an EXPAND image in the first <td>,
    // then this is a new region/country section.
    const hasExpand = row.querySelector('td:first-child img');
    if(hasExpand){
      const regionName = row.querySelector('td:nth-child(2) a').innerHTML;
      currentRegion = {
        name: regionName,
        revenue: { total:0, steam:0, ingame:0 },
        units: { total:0, steam:0, retail:0 },
        wishlists: { total:0 },
      };
      currentTable.regions.push(currentRegion);
    }

    // The 4th <td> contains the tally category/type
    const tallyRowName = row.querySelector('td:nth-child(4)').innerHTML.toLowerCase().replace(/&nbsp;/g,' ').replace(/<a.*/, '').trim();
    if(!tallyRowName) continue;
    let tallyCategory, tallyType;

    if(['wishlists', 'wishlist balance'].includes(tallyRowName)){
      tallyCategory = 'wishlists';
      tallyType = 'total';
    } else if(['revenue'].includes(tallyRowName)){
      tallyCategory = 'revenue';
      tallyType = 'total';
    } else if(tallyRowName === 'steam revenue'){
      tallyCategory = 'revenue';
      tallyType = 'steam';
    } else if(tallyRowName === 'in-game sales'){
      tallyCategory = 'revenue';
      tallyType = 'ingame';
    } else if(['units'].includes(tallyRowName)){
      tallyCategory = 'units';
      tallyType = 'total';
    } else if(tallyRowName === 'steam units'){
      tallyCategory = 'units';
      tallyType = 'steam';
    } else if(tallyRowName === 'retail activations'){
      tallyCategory = 'units';
      tallyType = 'retail';
    } else {
      continue;
    }

    let valueString = row.querySelector('td:nth-child(5)').innerHTML.replace(/[$\\s,]/g,'');
    if(valueString.startsWith('(')){
      valueString = '-' + valueString.replace(/[()]/g,'');
    }
    const value = +valueString;
    if(isNaN(value)){
      console.error('Unknown value', row.querySelector('td:nth-child(5)').innerHTML, {tallyRowName,tallyCategory,tallyType, value});
      continue;
    }

    currentRegion[tallyCategory][tallyType] = value;
  }

  // Create a CSV combining all tables, with headers:
  // Table, Region, revenue (total), revenue (steam), ...
  const csv = [
    ['Table', 'Region', 'Wishlists (total)', 'Revenue (total)', 'Revenue (steam)', 'Revenue (in-game)', 'Units (total)', 'Units (steam)', 'Units (retail)'].join(','),
    ...tables.flatMap(table => table.regions.map(region => [
      table.name.replace(/,/g, ';'),
      region.name.replace(/,/g, ';'),
      region.wishlists.total,
      region.revenue.total,
      region.revenue.steam,
      region.revenue.ingame,
      region.units.total,
      region.units.steam,
      region.units.retail,
    ].join(','))),
  ].join('\\\\n');

  const asJson = JSON.stringify(tables).replace(/^"(.*)"$/,"$1").replace(/"/g, '&quot;');
  const asTsv = csv.replace(/,/g, '\\t');
  

  // Insert buttons above the table to copy as CSV and as JSON
  const copyAsCsv = "navigator.clipboard.writeText('"+csv.replaceAll("'"," ")+"')";
  const copyAsTsv = "navigator.clipboard.writeText('"+csv.replaceAll("'"," ").replaceAll(",", '\\t')+"')";
  const copyAsJson = "navigator.clipboard.writeText('"+asJson+"')";

  const copyEl = document.createElement('div');
  copyEl.id="stitch-copy-container";
  copyEl.innerHTML = '<a href="https://bscotch.github.io/stitch/steam-tools" target="_blank" style="color:yellow;">Stitch</a>: <button onclick="'+copyAsCsv+'">Copy CSV</button> <button onclick="'+copyAsTsv+'">Copy TSV</button>  <button onclick="'+copyAsJson+'">Copy JSON</button>';
  copyEl.style="margin-bottom:0.5em; font-size: 1.1rem; font-weight:bold;"

  const existing = document.querySelector('#stitch-copy-container');
  if (existing) {
    existing.remove(); 
  }
  const table = document.querySelector('table.grouping_table');
  table.parentNode.insertBefore(copyEl, table);
})()`;

export const steamRegionsBookmarklet = `javascript:${encodeURIComponent(steamRegionsIife)}`;
