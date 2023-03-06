export enum TokenKind {
  Number,
  String,
  Boolean,
  Keyword,
  Identifier,
  Punctuation,
  LeftParen,
  RightParen,
  LeftBrace,
  RightBrace,
  LeftBracket,
  RightBracket,
  Semicolon,
  Comma,
  Equals,
  Operator,
  Eol,
  RegionStart,
  RegionEnd,
}

export const keywords = [
  'begin',
  'end',
  'if',
  'then',
  'else',
  'while',
  'do',
  'for',
  'break',
  'continue',
  'with',
  'until',
  'repeat',
  'exit',
  'and',
  'or',
  'xor',
  'not',
  'return',
  'mod',
  'div',
  'switch',
  'case',
  'default',
  'var',
  'global',
  'globalvar',
  'enum',
  'function',
  'try',
  'catch',
  'finally',
  'throw',
  'static',
  'new',
  'delete',
  'constructor',
  '#macro',
  '#region',
  '#endregion',
] as const;
export const whitespace = [' ', '\t', '\n', '\r'] as const;
export const punctuation = [',', ';', ':', '\\', "'"] as const;
export const operators = [
  '+',
  '-',
  '*',
  '/',
  '%',
  '=',
  '&',
  '|',
  '<',
  '>',
  '!',
  '?',
  '.',
  '$',
  '^',
  '@',
] as const;

export enum SyntaxKind {
  Any,
  FunctionDeclaration,
  ConstructorDeclaration,
  MacroDeclaration,
  Identifier,
  EnumDeclaration,
  EnumEntry,
  GlobalVarDeclaration,
  FunctionParameter,
  FunctionParameterOptional,
}

export type Node =
  | Any
  | FunctionDeclaration
  | MacroDeclaration
  | Identifier
  | EnumDeclaration
  | EnumEntry
  | GlobalVarDeclaration
  | FunctionParameter
  | ConstructorDeclaration;

export interface Position {
  line: number;
  column: number;
}

export interface ParsedNode {
  kind: SyntaxKind;
  name: string | null;
  range: [number, number];
  info: any;
  position: Position;
  children: ParsedNode[];
}

export interface Any extends ParsedNode {
  kind: SyntaxKind.Any;
  name: null;
  /** The entity */
  info: string;
}

export interface FunctionParameter extends ParsedNode {
  kind: SyntaxKind.FunctionParameter;
  name: string;
  info: { optional: boolean };
}

export interface FunctionDeclaration extends ParsedNode {
  kind: SyntaxKind.FunctionDeclaration;
  name: string | null;
  info: FunctionParameter[];
}

export interface ConstructorDeclaration extends ParsedNode {
  kind: SyntaxKind.ConstructorDeclaration;
  name: string | null;
  info: FunctionParameter[];
}

export interface MacroDeclaration extends ParsedNode {
  kind: SyntaxKind.MacroDeclaration;
  name: string;
  info: string | undefined;
}

export interface EnumEntry extends ParsedNode {
  kind: SyntaxKind.EnumEntry;
  name: string;
  info: number | undefined;
}

export interface EnumDeclaration extends ParsedNode {
  kind: SyntaxKind.EnumDeclaration;
  name: string;
  info: Map<EnumEntry['name'], EnumEntry>;
}

export interface GlobalVarDeclaration extends ParsedNode {
  kind: SyntaxKind.GlobalVarDeclaration;
  name: string;
  info: undefined;
}

/**
 * General identifier, e.g. something not
 * otherwise classified or a reference to
 * an entity.
 */
export interface Identifier extends ParsedNode {
  kind: SyntaxKind.Identifier;
  name: string;
  info: undefined;
}
