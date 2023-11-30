import dictionary from 'dictionary-en';
import fsp from 'fs/promises';

await fsp.writeFile(
  './src/dict.ts',
  `export const aff = \`${dictionary.aff}\`;\nexport const dic = \`${dictionary.dic}\`;`,
);
