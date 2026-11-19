import { codeTokens } from './tokens.code.ts';
import { tokenListToObject } from './tokens.lib.ts';
import {
  multilineDoubleStringTokens,
  multilineSingleStringTokens,
  stringTokens,
  templateTokens,
} from './tokens.strings.ts';
export { c, categories } from './tokens.categories.ts';

export const tokens = [
  ...codeTokens,
  ...stringTokens,
  ...multilineDoubleStringTokens,
  ...multilineSingleStringTokens,
  ...templateTokens,
];

export const t = tokenListToObject(tokens);
