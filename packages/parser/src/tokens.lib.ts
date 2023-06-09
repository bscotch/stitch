import {
  createToken as createTokenBase,
  ITokenConfig as ITokenConfigBase,
  TokenType as TokenTypeBase,
} from 'chevrotain';
export { Lexer } from 'chevrotain';

export type GmlLexerMode =
  | 'code'
  | 'string'
  | 'multilineDoubleString'
  | 'multilineSingleString'
  | 'template';

export interface TokenType<Name extends string = string> extends TokenTypeBase {
  name: Name;
}

export interface ITokenConfig<Name extends string = string>
  extends ITokenConfigBase {
  name: Name;
  push_mode?: GmlLexerMode;
}

export function createToken<Name extends string = string>(
  config: ITokenConfig<Name>,
): TokenType<Name> {
  return createTokenBase(config) as any;
}

export function tokenListToObject<T extends TokenType[]>(
  tokens: T,
): { [Name in T[number]['name']]: TokenType<Name> } {
  return tokens.reduce((acc, token) => {
    acc[token.name] = token;
    return acc;
  }, {} as any);
}
