export type * from './ast.ts';
export type { SyntaxDiagnostic, SyntaxDiagnosticCode } from './diagnostics.ts';
export { leadingDocComments, tokenIndexAt } from './docs.ts';
export {
  parseDocComment,
  type DocComment,
  type DocLink,
  type DocName,
  type DocTag,
  type DocTagKind,
  type DocText,
} from './jsdoc.ts';
export {
  flattenDocType,
  formatDocType,
  parseDocType,
  type DocNamedType,
  type DocType,
  type DocTypeParseResult,
  type DocUnionType,
  type Span,
} from './jsdoc.types.ts';
export { lex, type LexResult } from './lexer.ts';
export { LineIndex, type LinePosition } from './lineIndex.ts';
export { binaryPrecedence, parse, type ParseResult } from './parser.ts';
export {
  isAssignmentOperator,
  isComment,
  isDocComment,
  isTrivia,
  keywordAliases,
  keywords,
  type AssignmentOperatorKind,
  type KeywordKind,
  type OperatorKind,
  type PunctuationKind,
  type SignificantKind,
  type Token,
  type TokenKind,
  type TriviaKind,
} from './tokens.ts';
export { childrenOf, nodePathAt, walk } from './walk.ts';
