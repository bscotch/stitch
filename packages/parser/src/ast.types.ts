// Adapted from the ESTREE types from: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/estree/index.d.ts
// ESTREE project: https://github.com/estree/estree

import type { IRange } from './project.location.js';

export interface BaseNodeWithoutComments {
  // Every leaf interface that extends BaseNode must specify a type property.
  // The type property should be a string literal. For example, Identifier
  // has: `type: "Identifier"`
  type: string;
  loc?: IRange;
}

export interface BaseNode extends BaseNodeWithoutComments {
  leadingComments?: Comment[] | undefined;
  trailingComments?: Comment[] | undefined;
}

export interface Position {
  /** 1-indexed */
  line: number;
  /** 1-indexed */
  column: number;
  /** 0-indexed */
  offset: number;
}

export interface File extends BaseNode {
  type: 'File';
  body: Array<Statement>;
}

export interface EnumStatement extends BaseNode {
  type: 'EnumStatement';
  id: Identifier;
  body: EnumMember[];
}

export interface EnumMember extends BaseNode {
  type: 'EnumMember';
  id: Identifier;
  value?: RealLiteral;
}

export interface Identifier extends BaseNode, BaseExpression, BasePattern {
  type: 'Identifier';
  name: string;
}

export type Literal =
  | StringLiteral
  | BooleanLiteral
  | PointerLiteral
  | RealLiteral;

export interface LiteralBase extends BaseNode, BaseExpression {
  type: 'Literal';
  value: string | boolean | number | null;
  raw?: string | undefined;
}

export interface RealLiteral extends LiteralBase {
  kind: 'Real';
  value: number;
}

export interface PointerLiteral extends LiteralBase {
  kind: 'Pointer';
  value: string;
}

export interface StringLiteral extends LiteralBase {
  kind: 'String';
  value: string;
}

export interface BooleanLiteral extends LiteralBase {
  kind: 'Boolean';
  value: boolean;
}

////////////

export interface NodeMap {
  AssignmentProperty: AssignmentProperty;
  CatchClause: CatchClause;
  Class: Class;
  ClassBody: ClassBody;
  EnumStatement: EnumStatement;
  EnumMember: EnumMember;
  Expression: Expression;
  Function: FunctionNode;
  Identifier: Identifier;
  Literal: Literal;
  MethodDefinition: MethodDefinition;
  Pattern: Pattern;
  PrivateIdentifier: PrivateIdentifier;
  Program: File;
  Property: Property;
  PropertyDefinition: PropertyDefinition;
  Statement: Statement;
  Super: Super;
  SwitchCase: SwitchCase;
  TemplateElement: TemplateElement;
  VariableDeclarator: VariableDeclarator;
}

export type Node = NodeMap[keyof NodeMap];

export interface Comment extends BaseNodeWithoutComments {
  type: 'Line' | 'Block';
  value: string;
}

export interface BaseFunction extends BaseNode {
  params: Pattern[];
  generator?: boolean | undefined;
  // The body is either BlockStatement or Expression because arrow functions
  // can have a body that's either. FunctionDeclarations and
  // FunctionExpressions have only BlockStatement bodies.
  body: BlockStatement | Expression;
}

export type FunctionNode = FunctionDeclaration | FunctionExpression;

export type Statement =
  | EnumStatement
  | ExpressionStatement
  | BlockStatement
  | StaticBlock
  | EmptyStatement
  | DebuggerStatement
  | WithStatement
  | ReturnStatement
  | LabeledStatement
  | BreakStatement
  | ContinueStatement
  | IfStatement
  | SwitchStatement
  | ThrowStatement
  | TryStatement
  | WhileStatement
  | DoWhileStatement
  | ForStatement
  | ForInStatement
  | ForOfStatement
  | Declaration;

export interface BaseStatement extends BaseNode {}

export interface EmptyStatement extends BaseStatement {
  type: 'EmptyStatement';
}

export interface BlockStatement extends BaseStatement {
  type: 'BlockStatement';
  body: Statement[];
  innerComments?: Comment[] | undefined;
}

export interface StaticBlock extends Omit<BlockStatement, 'type'> {
  type: 'StaticBlock';
}

export interface ExpressionStatement extends BaseStatement {
  type: 'ExpressionStatement';
  expression: Expression;
}

export interface IfStatement extends BaseStatement {
  type: 'IfStatement';
  test: Expression;
  consequent: Statement;
  alternate?: Statement | null | undefined;
}

export interface LabeledStatement extends BaseStatement {
  type: 'LabeledStatement';
  label: Identifier;
  body: Statement;
}

export interface BreakStatement extends BaseStatement {
  type: 'BreakStatement';
  label?: Identifier | null | undefined;
}

export interface ContinueStatement extends BaseStatement {
  type: 'ContinueStatement';
  label?: Identifier | null | undefined;
}

export interface WithStatement extends BaseStatement {
  type: 'WithStatement';
  object: Expression;
  body: Statement;
}

export interface SwitchStatement extends BaseStatement {
  type: 'SwitchStatement';
  discriminant: Expression;
  cases: SwitchCase[];
}

export interface ReturnStatement extends BaseStatement {
  type: 'ReturnStatement';
  argument?: Expression | null | undefined;
}

export interface ThrowStatement extends BaseStatement {
  type: 'ThrowStatement';
  argument: Expression;
}

export interface TryStatement extends BaseStatement {
  type: 'TryStatement';
  block: BlockStatement;
  handler?: CatchClause | null | undefined;
  finalizer?: BlockStatement | null | undefined;
}

export interface WhileStatement extends BaseStatement {
  type: 'WhileStatement';
  test: Expression;
  body: Statement;
}

export interface DoWhileStatement extends BaseStatement {
  type: 'DoWhileStatement';
  body: Statement;
  test: Expression;
}

export interface ForStatement extends BaseStatement {
  type: 'ForStatement';
  init?: VariableDeclaration | Expression | null | undefined;
  test?: Expression | null | undefined;
  update?: Expression | null | undefined;
  body: Statement;
}

export interface BaseForXStatement extends BaseStatement {
  left: VariableDeclaration | Pattern;
  right: Expression;
  body: Statement;
}

export interface ForInStatement extends BaseForXStatement {
  type: 'ForInStatement';
}

export interface DebuggerStatement extends BaseStatement {
  type: 'DebuggerStatement';
}

export type Declaration =
  | FunctionDeclaration
  | VariableDeclaration
  | ClassDeclaration;

export interface BaseDeclaration extends BaseStatement {}

export interface FunctionDeclaration extends BaseFunction, BaseDeclaration {
  type: 'FunctionDeclaration';
  /** It is null when a function declaration is a part of the `export default function` statement */
  id: Identifier | null;
  body: BlockStatement;
}

export interface VariableDeclaration extends BaseDeclaration {
  type: 'VariableDeclaration';
  declarations: VariableDeclarator[];
  kind: 'var' | 'let' | 'const';
}

export interface VariableDeclarator extends BaseNode {
  type: 'VariableDeclarator';
  id: Pattern;
  init?: Expression | null | undefined;
}

export interface ExpressionMap {
  ArrayExpression: ArrayExpression;
  AssignmentExpression: AssignmentExpression;
  BinaryExpression: BinaryExpression;
  CallExpression: CallExpression;
  ChainExpression: ChainExpression;
  ClassExpression: ClassExpression;
  ConditionalExpression: ConditionalExpression;
  FunctionExpression: FunctionExpression;
  Identifier: Identifier;
  Literal: Literal;
  LogicalExpression: LogicalExpression;
  MemberExpression: MemberExpression;
  NewExpression: NewExpression;
  ObjectExpression: ObjectExpression;
  SequenceExpression: SequenceExpression;
  TaggedTemplateExpression: TaggedTemplateExpression;
  TemplateLiteral: TemplateLiteral;
  ThisExpression: ThisExpression;
  UnaryExpression: UnaryExpression;
  UpdateExpression: UpdateExpression;
}

export type Expression = ExpressionMap[keyof ExpressionMap];

export interface BaseExpression extends BaseNode {}

export type ChainElement = SimpleCallExpression | MemberExpression;

export interface ChainExpression extends BaseExpression {
  type: 'ChainExpression';
  expression: ChainElement;
}

export interface ThisExpression extends BaseExpression {
  type: 'ThisExpression';
}

export interface ArrayExpression extends BaseExpression {
  type: 'ArrayExpression';
  elements: Array<Expression | null>;
}

export interface ObjectExpression extends BaseExpression {
  type: 'ObjectExpression';
  properties: Array<Property>;
}

export interface PrivateIdentifier extends BaseNode {
  type: 'PrivateIdentifier';
  name: string;
}

export interface Property extends BaseNode {
  type: 'Property';
  key: Expression | PrivateIdentifier;
  value: Expression | Pattern; // Could be an AssignmentProperty
  kind: 'init' | 'get' | 'set';
  method: boolean;
  shorthand: boolean;
  computed: boolean;
}

export interface PropertyDefinition extends BaseNode {
  type: 'PropertyDefinition';
  key: Expression | PrivateIdentifier;
  value?: Expression | null | undefined;
  computed: boolean;
  static: boolean;
}

export interface FunctionExpression extends BaseFunction, BaseExpression {
  id?: Identifier | null | undefined;
  type: 'FunctionExpression';
  body: BlockStatement;
}

export interface SequenceExpression extends BaseExpression {
  type: 'SequenceExpression';
  expressions: Expression[];
}

export interface UnaryExpression extends BaseExpression {
  type: 'UnaryExpression';
  operator: UnaryOperator;
  prefix: true;
  argument: Expression;
}

export interface BinaryExpression extends BaseExpression {
  type: 'BinaryExpression';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export interface AssignmentExpression extends BaseExpression {
  type: 'AssignmentExpression';
  operator: AssignmentOperator;
  left: Pattern | MemberExpression;
  right: Expression;
}

export interface UpdateExpression extends BaseExpression {
  type: 'UpdateExpression';
  operator: UpdateOperator;
  argument: Expression;
  prefix: boolean;
}

export interface LogicalExpression extends BaseExpression {
  type: 'LogicalExpression';
  operator: LogicalOperator;
  left: Expression;
  right: Expression;
}

export interface ConditionalExpression extends BaseExpression {
  type: 'ConditionalExpression';
  test: Expression;
  alternate: Expression;
  consequent: Expression;
}

export interface BaseCallExpression extends BaseExpression {
  callee: Expression | Super;
  arguments: Array<Expression>;
}
export type CallExpression = SimpleCallExpression | NewExpression;

export interface SimpleCallExpression extends BaseCallExpression {
  type: 'CallExpression';
  optional: boolean;
}

export interface NewExpression extends BaseCallExpression {
  type: 'NewExpression';
}

export interface MemberExpression extends BaseExpression, BasePattern {
  type: 'MemberExpression';
  object: Expression | Super;
  property: Expression | PrivateIdentifier;
  computed: boolean;
  optional: boolean;
}

export type Pattern =
  | Identifier
  | ObjectPattern
  | ArrayPattern
  | AssignmentPattern
  | MemberExpression;

export interface BasePattern extends BaseNode {}

export interface SwitchCase extends BaseNode {
  type: 'SwitchCase';
  test?: Expression | null | undefined;
  consequent: Statement[];
}

export interface CatchClause extends BaseNode {
  type: 'CatchClause';
  param: Pattern | null;
  body: BlockStatement;
}

export type UnaryOperator =
  | '-'
  | '+'
  | '!'
  | '~'
  | 'typeof'
  | 'void'
  | 'delete';

export type BinaryOperator =
  | '=='
  | '!='
  | '==='
  | '!=='
  | '<'
  | '<='
  | '>'
  | '>='
  | '<<'
  | '>>'
  | '>>>'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '**'
  | '|'
  | '^'
  | '&'
  | 'in'
  | 'instanceof';

export type LogicalOperator = '||' | '&&' | '??';

export type AssignmentOperator =
  | '='
  | '+='
  | '-='
  | '*='
  | '/='
  | '%='
  | '**='
  | '<<='
  | '>>='
  | '>>>='
  | '|='
  | '^='
  | '&='
  | '||='
  | '&&='
  | '??=';

export type UpdateOperator = '++' | '--';

export interface ForOfStatement extends BaseForXStatement {
  type: 'ForOfStatement';
  await: boolean;
}

export interface Super extends BaseNode {
  type: 'Super';
}

export interface TemplateLiteral extends BaseExpression {
  type: 'TemplateLiteral';
  quasis: TemplateElement[];
  expressions: Expression[];
}

export interface TaggedTemplateExpression extends BaseExpression {
  type: 'TaggedTemplateExpression';
  tag: Expression;
  quasi: TemplateLiteral;
}

export interface TemplateElement extends BaseNode {
  type: 'TemplateElement';
  tail: boolean;
  value: {
    /** It is null when the template literal is tagged and the text has an invalid escape (e.g. - tag`\unicode and \u{55}`) */
    cooked?: string | null | undefined;
    raw: string;
  };
}

export interface AssignmentProperty extends Property {
  value: Pattern;
  kind: 'init';
  method: boolean; // false
}

export interface ObjectPattern extends BasePattern {
  type: 'ObjectPattern';
  properties: Array<AssignmentProperty>;
}

export interface ArrayPattern extends BasePattern {
  type: 'ArrayPattern';
  elements: Array<Pattern | null>;
}

export interface AssignmentPattern extends BasePattern {
  type: 'AssignmentPattern';
  left: Pattern;
  right: Expression;
}

export type Class = ClassDeclaration | ClassExpression;
export interface BaseClass extends BaseNode {
  superClass?: Expression | null | undefined;
  body: ClassBody;
}

export interface ClassBody extends BaseNode {
  type: 'ClassBody';
  body: Array<MethodDefinition | PropertyDefinition | StaticBlock>;
}

export interface MethodDefinition extends BaseNode {
  type: 'MethodDefinition';
  key: Expression | PrivateIdentifier;
  value: FunctionExpression;
  kind: 'constructor' | 'method' | 'get' | 'set';
  computed: boolean;
  static: boolean;
}

export interface ClassDeclaration extends BaseClass, BaseDeclaration {
  type: 'ClassDeclaration';
  /** It is null when a class declaration is a part of the `export default class` statement */
  id: Identifier | null;
}

export interface ClassExpression extends BaseClass, BaseExpression {
  type: 'ClassExpression';
  id?: Identifier | null | undefined;
}
