import { pathy } from '@bscotch/pathy';

/**
 * @typedef Theme
 * @property {Object.<string, {iconPath: string}>} iconDefinitions
 */

const sourceFolders = /** @type {const} */ (['files', 'gm', 'gm/obj']);

const themePath = pathy('images/icon-theme.json');
const typesPath = pathy('src/icons.types.mts');

/** @type {Theme} */
const theme = await themePath.read();
theme.iconDefinitions = {};

/** @type {string[]} */
const typesStrings = [];
for (const folder of sourceFolders) {
  const folderPath = pathy(`images/${folder}`);
  const files = await folderPath.listChildren();
  /** @type {string[]} */
  let types = [];
  for (const file of files) {
    if (!file.hasExtension('svg')) {
      continue;
    }
    const name =
      folder === 'files'
        ? file.name
        : `${folder}/${file.name}`.replace(/[_/\\]+/g, '-');
    types.push(file.name);
    theme.iconDefinitions[name] = {
      iconPath: `./${folder}/${file.basename}`,
    };
  }
  const typeName =
    folder === 'files'
      ? 'FileIcon'
      : folder === 'gm'
      ? 'GameMakerIcon'
      : 'GameMakerObjectEventIcon';
  typesStrings.push(`export type ${typeName} = '${types.join("' | '")}'`);
}

await themePath.write(theme);
await typesPath.write(typesStrings.join('\n'));
