// Convert the World Handbook into a list of languages and their proportional languages

import fs from 'fs/promises';
import fetch from 'node-fetch';

let download = false;

const steamCountries = [
  { name: "Argentina"},
  { name: "Australia"},
  { name: "Austria"},
  { name: "Azerbaijan"},
  { name: "Belarus"},
  { name: "Belgium"},
  { name: "Brazil"},
  { name: "Brunei Darussalam"},
  { name: "Bulgaria"},
  { name: "Canada"},
  { name: "Cayman Islands"},
  { name: "Chile"},
  { name: "China"},
  { name: "Colombia"},
  { name: "Costa Rica"},
  { name: "Czech Republic", alt: "Czechia"},
  { name: "Denmark"},
  { name: "El Salvador"},
  { name: "Finland"},
  { name: "France"},
  { name: "Germany"},
  { name: "Guatemala"},
  { name: "Hong Kong"},
  { name: "Hungary"},
  { name: "India"},
  { name: "Indonesia"},
  { name: "Ireland"},
  { name: "Italy"},
  { name: "Japan"},
  { name: "Jordan"},
  { name: "Kazakhstan"},
  { name: "Korea, Republic of", alt: "Korea, South"},
  { name: "Kuwait"},
  { name: "Latvia"},
  { name: "Lithuania"},
  { name: "Malaysia"},
  { name: "Mexico"},
  { name: "Netherlands"},
  { name: "New Zealand"},
  { name: "Norway"},
  { name: "Panama"},
  { name: "Peru"},
  { name: "Philippines"},
  { name: "Poland"},
  { name: "Portugal"},
  { name: "Romania"},
  { name: "Russian Federation", alt: "Russia"},
  { name: "Singapore"},
  { name: "Slovakia (Slovak Republic)"},
  { name: "Slovenia"},
  { name: "South Africa"},
  { name: "Spain"},
  { name: "Sweden"},
  { name: "Taiwan"},
  { name: "Thailand"},
  { name: "Turkey"},
  { name: "Ukraine"},
  { name: "United Arab Emirates"},
  { name: "United Kingdom"},
  { name: "United States"},
  { name: "Uruguay"},
  { name: "Viet Nam", alt: "Vietnam"},
];

/** @type {import('./WorldHandbook.js').WorldDataCountry[]} */
let countries = [];
if (download) {
  
  const handbookRaw = /** @type {import('./WorldHandbook.js').WorldData} */(await fetch('https://www.cia.gov/the-world-factbook/page-data/field/languages/page-data.json').then(res => res.json()));
  countries = handbookRaw.result.data.fields.nodes;

  await fs.mkdir('./tmp', { recursive: true });
  await fs.writeFile('./tmp/world-handbook.json', JSON.stringify(countries, null, 2));
}
else {
  countries = JSON.parse(await fs.readFile('./tmp/world-handbook.json', 'utf8'));
}

/** @type {{[name:string]:{name:string,percent:number}[]}} */
const languagesByCountry = {};
for (const country of countries) {
  // Clean up and convert the languages description into a list of languages and percentages
  if (country.placeName === 'World') continue;
  let languagesString = "";
  // Remove parentheticals
  let lefts = 0;
  for (const char of country.formatted) {
    if (char === '(') {
      lefts++;
    }
    else if (char === ')') {
      lefts--;
    }
    else if (lefts === 0) {
      languagesString += char;
    }
  }

  languagesString = languagesString
    .replace(/&nbsp/g, ' ')
    .replace(/(;|<).*/, '')
    .replace(/\s+/g, ' ').trim();
  if (!languagesString) {
    // We somehow parsed it all away
    continue;
  }
  if (languagesString.includes('(')) {
    console.error(`Still has parens: ${languagesString}`);
    console.error(country.formatted)
  }
  const languageStrings = languagesString.split(/\s*,\s*/g);

  /** @type {{name:string,percent:number}[]} */
  const languages = [];
  for(const languageString of languageStrings) {
    // Check for a percentage. If there isn't one,
    // we'll assume it's 100% and skip the other langs
    const parts = languageString.match(/^(?<name>.*?)\s+(?<percent>[\d.]+)%.*$/);
    const percent = parts?.groups?.percent ? parseFloat(parts.groups.percent) : 100;

    let name = parts?.groups?.name ?? languageString;
    name = name.replace(/ (or|and|only).*$/, '');
    if (name.match(/\b(pidgin|indigenous|not|other|\d+|\/)\b/i)) {
      // Then this is either details or something we definitely can't cover
      continue;
    }
    if (percent < 10) { break; }

    languages.push({ name, percent });

    if (percent === 100 ) {
      break;
    }
  }
  if (languages.length) {
    const countryName = country.placeName.replace(/\s+\(.*$/, '');
    languagesByCountry[countryName] = languages;
  }
}

for (const country of steamCountries) {
  // Try to find it in the list of countries


  let languages =
    languagesByCountry[country.name] ||
    languagesByCountry[country.alt] ||
    languagesByCountry[country.name.replace(/,.*$/, '')] ||
    languagesByCountry[country.name.replace(/ .*$/, '')];
  
  if (!languages) {
    console.error(`Couldn't find ${country.name}`);
    continue;
  }
  country.languages = languages;
}

await fs.writeFile('./tmp/steam-countries.json', JSON.stringify(steamCountries, null, 2));

// TODO: NORMALIZE THE LANGUAGE NAMES