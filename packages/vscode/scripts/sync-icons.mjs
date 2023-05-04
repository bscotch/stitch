import { pathy } from '@bscotch/pathy';

/**
 * @typedef Theme
 * @property {Object.<string, {iconPath: string}>} iconDefinitions
 */

const sourceFolders = ['files', 'gm', 'gm/obj'];

const themePath = pathy('images/icon-theme.json');

/** @type {Theme} */
const theme = await themePath.read();
theme.iconDefinitions = {};

for (const folder of sourceFolders) {
  const folderPath = pathy(`images/${folder}`);
  const files = await folderPath.listChildren();
  for (const file of files) {
    if (!file.hasExtension('svg')) {
      continue;
    }
    const name =
      folder === 'files'
        ? file.name
        : `${folder}/${file.name}`.replace(/[_/\\]+/g, '-');
    theme.iconDefinitions[name] = {
      iconPath: `./${folder}/${file.basename}`,
    };
  }
}

await themePath.write(theme);
