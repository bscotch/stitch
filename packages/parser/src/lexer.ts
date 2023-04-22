import { Lexer } from 'chevrotain';
import type { GmlLexerMode, TokenType } from './lib.js';
import {
  codeTokens,
  multilineDoubleStringTokens,
  multilineSingleStringTokens,
  stringTokens,
  templateTokens,
} from './tokens.js';

export const GmlLexer = new Lexer({
  defaultMode: 'code',
  modes: {
    code: codeTokens,
    string: stringTokens,
    multilineDoubleString: multilineDoubleStringTokens,
    multilineSingleString: multilineSingleStringTokens,
    template: templateTokens,
  } satisfies { [Mode in GmlLexerMode]: TokenType[] },
});
