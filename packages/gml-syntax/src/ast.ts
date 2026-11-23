/**
 * The GML abstract syntax tree.
 *
 * Every node is a plain, serializable object with a `kind` discriminant and
 * `start`/`end` source offsets (`end` is exclusive). Child nodes are stored
 * in source order. Comments and whitespace are not part of the tree; find
 * them in the token stream by offset (see `docs.ts` for doc comments).
 *
 * Parse errors never throw: the tree is always complete, with
 * `MissingExpression` and `ErrorStatement` nodes standing in where the
 * source is incomplete or unparseable.
 */
import type { AssignmentOperatorKind } from './tokens.ts';

export interface NodeBase {
  start: number;
  end: number;
}

//#region Program and statements

export interface Program extends NodeBase {
  kind: 'Program';
  body: Statement[];
}

export type Statement =
  | Block
  | VariableDeclaration
  | Assignment
  | ExpressionStatement
  | IfStatement
  | WhileStatement
  | DoUntilStatement
  | ForStatement
  | RepeatStatement
  | WithStatement
  | SwitchStatement
  | TryStatement
  | ReturnStatement
  | ThrowStatement
  | BreakStatement
  | ContinueStatement
  | ExitStatement
  | FunctionDeclaration
  | EnumDeclaration
  | MacroDeclaration
  | EmptyStatement
  | ErrorStatement;

/** `{ ... }`, or `begin ... end` */
export interface Block extends NodeBase {
  kind: 'Block';
  body: Statement[];
}

/** `var a = 1, b;`, `static a = 1;`, or `globalvar a, b;` */
export interface VariableDeclaration extends NodeBase {
  kind: 'VariableDeclaration';
  keyword: 'var' | 'static' | 'globalvar';
  declarators: VariableDeclarator[];
}

export interface VariableDeclarator extends NodeBase {
  kind: 'VariableDeclarator';
  name: Identifier;
  init: Expression | null;
}

/**
 * `target = value`, `target += value`, etc.
 *
 * In GML assignment is a statement, not an expression: inside an
 * expression `=` means equality (see `BinaryExpression`).
 */
export interface Assignment extends NodeBase {
  kind: 'Assignment';
  operator: AssignmentOperatorKind;
  target: Expression;
  value: Expression;
}

export interface ExpressionStatement extends NodeBase {
  kind: 'ExpressionStatement';
  expression: Expression;
}

/** `if test [then] consequent [else alternate]` */
export interface IfStatement extends NodeBase {
  kind: 'IfStatement';
  test: Expression;
  consequent: Statement;
  alternate: Statement | null;
}

export interface WhileStatement extends NodeBase {
  kind: 'WhileStatement';
  test: Expression;
  body: Statement;
}

/** `do body until test` */
export interface DoUntilStatement extends NodeBase {
  kind: 'DoUntilStatement';
  body: Statement;
  test: Expression;
}

export interface ForStatement extends NodeBase {
  kind: 'ForStatement';
  init: VariableDeclaration | Assignment | ExpressionStatement | null;
  test: Expression | null;
  update: Assignment | ExpressionStatement | null;
  body: Statement;
}

export interface RepeatStatement extends NodeBase {
  kind: 'RepeatStatement';
  count: Expression;
  body: Statement;
}

export interface WithStatement extends NodeBase {
  kind: 'WithStatement';
  target: Expression;
  body: Statement;
}

export interface SwitchStatement extends NodeBase {
  kind: 'SwitchStatement';
  discriminant: Expression;
  cases: SwitchCase[];
}

/** A `case test:` or `default:` clause (`test` is null for `default`) */
export interface SwitchCase extends NodeBase {
  kind: 'SwitchCase';
  test: Expression | null;
  body: Statement[];
}

export interface TryStatement extends NodeBase {
  kind: 'TryStatement';
  block: Block;
  handler: CatchClause | null;
  finalizer: Block | null;
}

export interface CatchClause extends NodeBase {
  kind: 'CatchClause';
  param: Identifier | null;
  body: Block;
}

export interface ReturnStatement extends NodeBase {
  kind: 'ReturnStatement';
  argument: Expression | null;
}

export interface ThrowStatement extends NodeBase {
  kind: 'ThrowStatement';
  argument: Expression;
}

export interface BreakStatement extends NodeBase {
  kind: 'BreakStatement';
}

export interface ContinueStatement extends NodeBase {
  kind: 'ContinueStatement';
}

export interface ExitStatement extends NodeBase {
  kind: 'ExitStatement';
}

/** `function name(params) [: Parent(args)] [constructor] { ... }` */
export interface FunctionDeclaration extends FunctionBase {
  kind: 'FunctionDeclaration';
  name: Identifier;
}

export interface EnumDeclaration extends NodeBase {
  kind: 'EnumDeclaration';
  name: Identifier;
  members: EnumMember[];
}

export interface EnumMember extends NodeBase {
  kind: 'EnumMember';
  name: Identifier;
  init: Expression | null;
}

/**
 * `#macro [config:]NAME body`
 *
 * GML macros are token substitutions, so their bodies need not be valid
 * expressions. If the body parses as exactly one expression it is in `body`.
 * Otherwise `body` is null, and the raw body source is at
 * `bodyStart`..`bodyEnd`.
 */
export interface MacroDeclaration extends NodeBase {
  kind: 'MacroDeclaration';
  config: Identifier | null;
  name: Identifier;
  body: Expression | null;
  bodyStart: number;
  bodyEnd: number;
}

/** A lone `;` */
export interface EmptyStatement extends NodeBase {
  kind: 'EmptyStatement';
}

/** Source that could not be parsed as a statement */
export interface ErrorStatement extends NodeBase {
  kind: 'ErrorStatement';
}

//#endregion

//#region Expressions

export type Expression =
  | Identifier
  | Literal
  | TemplateString
  | ArrayLiteral
  | StructLiteral
  | FunctionExpression
  | ParenthesizedExpression
  | UnaryExpression
  | UpdateExpression
  | BinaryExpression
  | ConditionalExpression
  | MemberExpression
  | IndexExpression
  | CallExpression
  | NewExpression
  | MissingExpression;

/**
 * Any name, including the built-in scope names `self`, `other`, `global`,
 * `all` and `noone` and built-in constants like `pi` and `infinity`.
 */
export interface Identifier extends NodeBase {
  kind: 'Identifier';
  name: string;
}

export interface Literal extends NodeBase {
  kind: 'Literal';
  literalKind: 'number' | 'string' | 'rawString' | 'boolean' | 'undefined';
  /** The literal's source text, exactly as written */
  raw: string;
}

/** `$"text {expression} text"` */
export interface TemplateString extends NodeBase {
  kind: 'TemplateString';
  parts: (TemplateText | Expression)[];
}

export interface TemplateText extends NodeBase {
  kind: 'TemplateText';
  raw: string;
}

export interface ArrayLiteral extends NodeBase {
  kind: 'ArrayLiteral';
  elements: Expression[];
}

export interface StructLiteral extends NodeBase {
  kind: 'StructLiteral';
  properties: StructProperty[];
}

/** `key: value`, or the shorthand `key` (where `value` is null) */
export interface StructProperty extends NodeBase {
  kind: 'StructProperty';
  key: Identifier | Literal;
  value: Expression | null;
}

interface FunctionBase extends NodeBase {
  params: Parameter[];
  /** For constructors, the parent constructor call (`: Parent(args)`) */
  parent: ConstructorParent | null;
  isConstructor: boolean;
  body: Block;
}

export interface FunctionExpression extends FunctionBase {
  kind: 'FunctionExpression';
  name: Identifier | null;
}

export interface Parameter extends NodeBase {
  kind: 'Parameter';
  name: Identifier;
  defaultValue: Expression | null;
}

export interface ConstructorParent extends NodeBase {
  kind: 'ConstructorParent';
  name: Identifier;
  args: Argument[];
}

export interface ParenthesizedExpression extends NodeBase {
  kind: 'ParenthesizedExpression';
  expression: Expression;
}

export type UnaryOperator = '-' | '+' | '!' | '~' | 'delete';

export interface UnaryExpression extends NodeBase {
  kind: 'UnaryExpression';
  operator: UnaryOperator;
  argument: Expression;
}

/** `++x`, `x++`, `--x`, `x--` */
export interface UpdateExpression extends NodeBase {
  kind: 'UpdateExpression';
  operator: '++' | '--';
  prefix: boolean;
  argument: Expression;
}

export type BinaryOperator =
  | '??'
  | '||'
  | '^^'
  | '&&'
  | '=='
  | '!='
  /** Equality comparison, when `=` is used inside an expression */
  | '='
  | '<'
  | '<='
  | '>'
  | '>='
  | '|'
  | '^'
  | '&'
  | '<<'
  | '>>'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | 'div';

export interface BinaryExpression extends NodeBase {
  kind: 'BinaryExpression';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

/** `test ? consequent : alternate` */
export interface ConditionalExpression extends NodeBase {
  kind: 'ConditionalExpression';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

/** `object.property` */
export interface MemberExpression extends NodeBase {
  kind: 'MemberExpression';
  object: Expression;
  property: Identifier;
}

export type Accessor =
  /** `[` */
  | 'array'
  /** `[@` */
  | 'arrayMutate'
  /** `[?` */
  | 'map'
  /** `[|` */
  | 'list'
  /** `[#` */
  | 'grid'
  /** `[$` */
  | 'struct';

/** `object[index]`, `object[$ key]`, `grid[# x, y]`, etc. */
export interface IndexExpression extends NodeBase {
  kind: 'IndexExpression';
  accessor: Accessor;
  object: Expression;
  /** One index, or two for grids and legacy 2D arrays */
  indices: Expression[];
}

export interface CallExpression extends NodeBase {
  kind: 'CallExpression';
  callee: Expression;
  args: Argument[];
}

/** `new Callee(args)` */
export interface NewExpression extends NodeBase {
  kind: 'NewExpression';
  callee: Expression;
  args: Argument[];
}

/** A call argument. GML allows omitting arguments, e.g. `f(a,,c)`. */
export type Argument = Expression | OmittedArgument;

export interface OmittedArgument extends NodeBase {
  kind: 'OmittedArgument';
}

/** Placeholder for an expression that is missing from the source */
export interface MissingExpression extends NodeBase {
  kind: 'MissingExpression';
}

//#endregion

export type Node =
  | Program
  | Statement
  | Expression
  | VariableDeclarator
  | SwitchCase
  | CatchClause
  | EnumMember
  | TemplateText
  | StructProperty
  | Parameter
  | ConstructorParent
  | OmittedArgument;

export type NodeKind = Node['kind'];
export type NodeOfKind<K extends NodeKind> = Extract<Node, { kind: K }>;
