import { Lexer } from 'chevrotain';
import { codeTokens } from './tokens.code.ts';
import type { GmlLexerMode, TokenType } from './tokens.lib.ts';
import {
  multilineDoubleStringTokens,
  multilineSingleStringTokens,
  stringTokens,
  templateTokens,
} from './tokens.strings.ts';

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
