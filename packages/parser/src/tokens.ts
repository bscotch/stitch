import { codeTokens } from './tokens.code.js';
import { jsdocsGmlTokens, jsdocsJsTokens } from './tokens.jsdocs.js';
import { tokenListToObject } from './tokens.lib.js';
import {
  multilineDoubleStringTokens,
  multilineSingleStringTokens,
  stringTokens,
  templateTokens,
} from './tokens.strings.js';
export { c, categories } from './tokens.categories.js';

export const tokens = [
  ...codeTokens,
  ...stringTokens,
  ...multilineDoubleStringTokens,
  ...multilineSingleStringTokens,
  ...templateTokens,
  ...jsdocsGmlTokens,
  ...jsdocsJsTokens,
];

export const t = tokenListToObject(tokens);
