import type { CstNode, ICstVisitor, IToken } from 'chevrotain';

export interface FileCstNode extends CstNode {
  name: 'file';
  children: FileCstChildren;
}

export type FileCstChildren = {
  statements: StatementsCstNode[];
};

export interface StatementsCstNode extends CstNode {
  name: 'statements';
  children: StatementsCstChildren;
}

export type StatementsCstChildren = {
  statement?: StatementCstNode[];
};

export interface StatementCstNode extends CstNode {
  name: 'statement';
  children: StatementCstChildren;
}

export type StatementCstChildren = {
  functionStatement?: FunctionStatementCstNode[];
  localVarDeclarationsStatement?: LocalVarDeclarationsStatementCstNode[];
  globalVarDeclarationsStatement?: GlobalVarDeclarationsStatementCstNode[];
  staticVarDeclarationStatement?: StaticVarDeclarationStatementCstNode[];
  variableAssignmentStatement?: VariableAssignmentStatementCstNode[];
  ifStatement?: IfStatementCstNode[];
  tryStatement?: TryStatementCstNode[];
  whileStatement?: WhileStatementCstNode[];
  forStatement?: ForStatementCstNode[];
  doUntilStatement?: DoUntilStatementCstNode[];
  switchStatement?: SwitchStatementCstNode[];
  breakStatement?: BreakStatementCstNode[];
  continueStatement?: ContinueStatementCstNode[];
  returnStatement?: ReturnStatementCstNode[];
  exitStatement?: ExitStatementCstNode[];
  withStatement?: WithStatementCstNode[];
  enumStatement?: EnumStatementCstNode[];
  macroStatement?: MacroStatementCstNode[];
  emptyStatement?: EmptyStatementCstNode[];
  repeatStatement?: RepeatStatementCstNode[];
  expressionStatement?: ExpressionStatementCstNode[];
  jsdoc?: JsdocCstNode[];
};

export interface JsdocCstNode extends CstNode {
  name: 'jsdoc';
  children: JsdocCstChildren;
}

export type JsdocCstChildren = {
  jsdocGml?: JsdocGmlCstNode[];
  jsdocJs?: JsdocJsCstNode[];
};

export interface JsdocGmlCstNode extends CstNode {
  name: 'jsdocGml';
  children: JsdocGmlCstChildren;
}

export type JsdocGmlCstChildren = {
  JsdocGmlLine: IToken[];
};

export interface JsdocJsCstNode extends CstNode {
  name: 'jsdocJs';
  children: JsdocJsCstChildren;
}

export type JsdocJsCstChildren = {
  JsdocJs: IToken[];
};

export interface StringLiteralCstNode extends CstNode {
  name: 'stringLiteral';
  children: StringLiteralCstChildren;
}

export type StringLiteralCstChildren = {
  StringStart: IToken[];
  Substring?: IToken[];
  StringEnd: IToken[];
};

export interface MultilineDoubleStringLiteralCstNode extends CstNode {
  name: 'multilineDoubleStringLiteral';
  children: MultilineDoubleStringLiteralCstChildren;
}

export type MultilineDoubleStringLiteralCstChildren = {
  MultilineDoubleStringStart: IToken[];
  Substring?: IToken[];
  MultilineDoubleStringEnd: IToken[];
};

export interface MultilineSingleStringLiteralCstNode extends CstNode {
  name: 'multilineSingleStringLiteral';
  children: MultilineSingleStringLiteralCstChildren;
}

export type MultilineSingleStringLiteralCstChildren = {
  MultilineSingleStringStart: IToken[];
  Substring?: IToken[];
  MultilineSingleStringEnd: IToken[];
};

export interface TemplateLiteralCstNode extends CstNode {
  name: 'templateLiteral';
  children: TemplateLiteralCstChildren;
}

export type TemplateLiteralCstChildren = {
  TemplateStart: IToken[];
  Substring?: IToken[];
  TemplateInterpStart?: IToken[];
  expression?: ExpressionCstNode[];
  EndBrace?: IToken[];
  TemplateStringEnd: IToken[];
};

export interface RepeatStatementCstNode extends CstNode {
  name: 'repeatStatement';
  children: RepeatStatementCstChildren;
}

export type RepeatStatementCstChildren = {
  Repeat: IToken[];
  expression: ExpressionCstNode[];
  blockableStatement: BlockableStatementCstNode[];
};

export interface ReturnStatementCstNode extends CstNode {
  name: 'returnStatement';
  children: ReturnStatementCstChildren;
}

export type ReturnStatementCstChildren = {
  Return: IToken[];
  assignmentRightHandSide?: AssignmentRightHandSideCstNode[];
  Semicolon?: IToken[];
};

export interface IfStatementCstNode extends CstNode {
  name: 'ifStatement';
  children: IfStatementCstChildren;
}

export type IfStatementCstChildren = {
  If: IToken[];
  expression: ExpressionCstNode[];
  Then?: IToken[];
  blockableStatement: BlockableStatementCstNode[];
  elseIfStatement?: ElseIfStatementCstNode[];
  elseStatement?: ElseStatementCstNode[];
};

export interface ElseIfStatementCstNode extends CstNode {
  name: 'elseIfStatement';
  children: ElseIfStatementCstChildren;
}

export type ElseIfStatementCstChildren = {
  Else: IToken[];
  If: IToken[];
  expression: ExpressionCstNode[];
  blockableStatement: BlockableStatementCstNode[];
};

export interface ElseStatementCstNode extends CstNode {
  name: 'elseStatement';
  children: ElseStatementCstChildren;
}

export type ElseStatementCstChildren = {
  Else: IToken[];
  blockableStatement: BlockableStatementCstNode[];
};

export interface BlockableStatementCstNode extends CstNode {
  name: 'blockableStatement';
  children: BlockableStatementCstChildren;
}

export type BlockableStatementCstChildren = {
  statement?: StatementCstNode[];
  blockStatement?: BlockStatementCstNode[];
};

export interface BlockableStatementsCstNode extends CstNode {
  name: 'blockableStatements';
  children: BlockableStatementsCstChildren;
}

export type BlockableStatementsCstChildren = {
  statements?: StatementsCstNode[];
  blockStatement?: BlockStatementCstNode[];
};

export interface BlockStatementCstNode extends CstNode {
  name: 'blockStatement';
  children: BlockStatementCstChildren;
}

export type BlockStatementCstChildren = {
  StartBrace: IToken[];
  statement?: StatementCstNode[];
  EndBrace: IToken[];
};

export interface ExpressionStatementCstNode extends CstNode {
  name: 'expressionStatement';
  children: ExpressionStatementCstChildren;
}

export type ExpressionStatementCstChildren = {
  expression: ExpressionCstNode[];
  Semicolon?: IToken[];
};

export interface ExpressionCstNode extends CstNode {
  name: 'expression';
  children: ExpressionCstChildren;
}

export type ExpressionCstChildren = {
  primaryExpression: PrimaryExpressionCstNode[];
  assignment?: AssignmentCstNode[];
  binaryExpression?: BinaryExpressionCstNode[];
  ternaryExpression?: TernaryExpressionCstNode[];
};

export interface BinaryExpressionCstNode extends CstNode {
  name: 'binaryExpression';
  children: BinaryExpressionCstChildren;
}

export type BinaryExpressionCstChildren = {
  BinaryOperator: IToken[];
  assignmentRightHandSide: AssignmentRightHandSideCstNode[];
};

export interface TernaryExpressionCstNode extends CstNode {
  name: 'ternaryExpression';
  children: TernaryExpressionCstChildren;
}

export type TernaryExpressionCstChildren = {
  QuestionMark: IToken[];
  assignmentRightHandSide: AssignmentRightHandSideCstNode[];
  Colon: IToken[];
};

export interface PrimaryExpressionCstNode extends CstNode {
  name: 'primaryExpression';
  children: PrimaryExpressionCstChildren;
}

export type PrimaryExpressionCstChildren = {
  UnaryPrefixOperator?: IToken[];
  BooleanLiteral?: IToken[];
  NumericLiteral?: IToken[];
  PointerLiteral?: IToken[];
  Undefined?: IToken[];
  NaN?: IToken[];
  stringLiteral?: StringLiteralCstNode[];
  multilineDoubleStringLiteral?: MultilineDoubleStringLiteralCstNode[];
  multilineSingleStringLiteral?: MultilineSingleStringLiteralCstNode[];
  templateLiteral?: TemplateLiteralCstNode[];
  identifierAccessor?: IdentifierAccessorCstNode[];
  parenthesizedExpression?: ParenthesizedExpressionCstNode[];
  arrayLiteral?: ArrayLiteralCstNode[];
  UnarySuffixOperator?: IToken[];
};

export interface IdentifierCstNode extends CstNode {
  name: 'identifier';
  children: IdentifierCstChildren;
}

export type IdentifierCstChildren = {
  Identifier?: IToken[];
  Self?: IToken[];
  Other?: IToken[];
  Global?: IToken[];
  Noone?: IToken[];
  All?: IToken[];
};

export interface IdentifierAccessorCstNode extends CstNode {
  name: 'identifierAccessor';
  children: IdentifierAccessorCstChildren;
}

export type IdentifierAccessorCstChildren = {
  New?: IToken[];
  identifier: IdentifierCstNode[];
  accessorSuffixes?: AccessorSuffixesCstNode[];
  assignment?: AssignmentCstNode[];
};

export interface ParenthesizedExpressionCstNode extends CstNode {
  name: 'parenthesizedExpression';
  children: ParenthesizedExpressionCstChildren;
}

export type ParenthesizedExpressionCstChildren = {
  StartParen: IToken[];
  expression: ExpressionCstNode[];
  EndParen: IToken[];
};

export interface AccessorSuffixesCstNode extends CstNode {
  name: 'accessorSuffixes';
  children: AccessorSuffixesCstChildren;
}

export type AccessorSuffixesCstChildren = {
  gridAccessSuffix?: GridAccessSuffixCstNode[];
  structAccessSuffix?: StructAccessSuffixCstNode[];
  listAccessSuffix?: ListAccessSuffixCstNode[];
  mapAccessSuffix?: MapAccessSuffixCstNode[];
  arrayMutationAccessorSuffix?: ArrayMutationAccessorSuffixCstNode[];
  arrayAccessSuffix?: ArrayAccessSuffixCstNode[];
  dotAccessSuffix?: DotAccessSuffixCstNode[];
  functionArguments?: FunctionArgumentsCstNode[];
};

export interface DotAccessSuffixCstNode extends CstNode {
  name: 'dotAccessSuffix';
  children: DotAccessSuffixCstChildren;
}

export type DotAccessSuffixCstChildren = {
  Dot: IToken[];
  identifier: IdentifierCstNode[];
};

export interface ArrayAccessSuffixCstNode extends CstNode {
  name: 'arrayAccessSuffix';
  children: ArrayAccessSuffixCstChildren;
}

export type ArrayAccessSuffixCstChildren = {
  StartBracket: IToken[];
  expression: ExpressionCstNode[];
  Comma?: IToken[];
  EndBracket: IToken[];
};

export interface StructAccessSuffixCstNode extends CstNode {
  name: 'structAccessSuffix';
  children: StructAccessSuffixCstChildren;
}

export type StructAccessSuffixCstChildren = {
  StructAccessorStart: IToken[];
  expression: ExpressionCstNode[];
  EndBracket: IToken[];
};

export interface ListAccessSuffixCstNode extends CstNode {
  name: 'listAccessSuffix';
  children: ListAccessSuffixCstChildren;
}

export type ListAccessSuffixCstChildren = {
  DsListAccessorStart: IToken[];
  expression: ExpressionCstNode[];
  EndBracket: IToken[];
};

export interface MapAccessSuffixCstNode extends CstNode {
  name: 'mapAccessSuffix';
  children: MapAccessSuffixCstChildren;
}

export type MapAccessSuffixCstChildren = {
  DsMapAccessorStart: IToken[];
  expression: ExpressionCstNode[];
  EndBracket: IToken[];
};

export interface GridAccessSuffixCstNode extends CstNode {
  name: 'gridAccessSuffix';
  children: GridAccessSuffixCstChildren;
}

export type GridAccessSuffixCstChildren = {
  DsGridAccessorStart: IToken[];
  expression: ExpressionCstNode[];
  Comma: IToken[];
  EndBracket: IToken[];
};

export interface ArrayMutationAccessorSuffixCstNode extends CstNode {
  name: 'arrayMutationAccessorSuffix';
  children: ArrayMutationAccessorSuffixCstChildren;
}

export type ArrayMutationAccessorSuffixCstChildren = {
  ArrayMutateAccessorStart: IToken[];
  expression: ExpressionCstNode[];
  EndBracket: IToken[];
};

export interface FunctionArgumentsCstNode extends CstNode {
  name: 'functionArguments';
  children: FunctionArgumentsCstChildren;
}

export type FunctionArgumentsCstChildren = {
  StartParen: IToken[];
  functionArgument?: FunctionArgumentCstNode[];
  Comma?: IToken[];
  EndParen: IToken[];
};

export interface FunctionArgumentCstNode extends CstNode {
  name: 'functionArgument';
  children: FunctionArgumentCstChildren;
}

export type FunctionArgumentCstChildren = {
  jsdoc?: JsdocCstNode[];
  assignmentRightHandSide: AssignmentRightHandSideCstNode[];
};

export interface EmptyStatementCstNode extends CstNode {
  name: 'emptyStatement';
  children: EmptyStatementCstChildren;
}

export type EmptyStatementCstChildren = {
  Semicolon: IToken[];
};

export interface EnumStatementCstNode extends CstNode {
  name: 'enumStatement';
  children: EnumStatementCstChildren;
}

export type EnumStatementCstChildren = {
  Enum: IToken[];
  Identifier: IToken[];
  StartBrace: IToken[];
  enumMember: EnumMemberCstNode[];
  Comma?: IToken[];
  EndBrace: IToken[];
};

export interface EnumMemberCstNode extends CstNode {
  name: 'enumMember';
  children: EnumMemberCstChildren;
}

export type EnumMemberCstChildren = {
  Identifier: IToken[];
  Assign?: IToken[];
  Minus?: IToken[];
  NumericLiteral?: IToken[];
};

export interface ConstructorSuffixCstNode extends CstNode {
  name: 'constructorSuffix';
  children: ConstructorSuffixCstChildren;
}

export type ConstructorSuffixCstChildren = {
  Colon?: IToken[];
  Identifier?: IToken[];
  functionArguments?: FunctionArgumentsCstNode[];
  Constructor: IToken[];
};

export interface FunctionExpressionCstNode extends CstNode {
  name: 'functionExpression';
  children: FunctionExpressionCstChildren;
}

export type FunctionExpressionCstChildren = {
  Function: IToken[];
  Identifier?: IToken[];
  functionParameters: FunctionParametersCstNode[];
  constructorSuffix?: ConstructorSuffixCstNode[];
  blockStatement: BlockStatementCstNode[];
};

export interface FunctionStatementCstNode extends CstNode {
  name: 'functionStatement';
  children: FunctionStatementCstChildren;
}

export type FunctionStatementCstChildren = {
  functionExpression: FunctionExpressionCstNode[];
  Semicolon?: IToken[];
};

export interface FunctionParametersCstNode extends CstNode {
  name: 'functionParameters';
  children: FunctionParametersCstChildren;
}

export type FunctionParametersCstChildren = {
  StartParen: IToken[];
  functionParameter?: FunctionParameterCstNode[];
  Comma?: IToken[];
  EndParen: IToken[];
};

export interface FunctionParameterCstNode extends CstNode {
  name: 'functionParameter';
  children: FunctionParameterCstChildren;
}

export type FunctionParameterCstChildren = {
  Identifier: IToken[];
  Assign?: IToken[];
  assignmentRightHandSide?: AssignmentRightHandSideCstNode[];
};

export interface MacroStatementCstNode extends CstNode {
  name: 'macroStatement';
  children: MacroStatementCstChildren;
}

export type MacroStatementCstChildren = {
  Macro: IToken[];
  Identifier: IToken[];
  expressionStatement: ExpressionStatementCstNode[];
};

export interface ForStatementCstNode extends CstNode {
  name: 'forStatement';
  children: ForStatementCstChildren;
}

export type ForStatementCstChildren = {
  For: IToken[];
  StartParen: IToken[];
  localVarDeclarations?: LocalVarDeclarationsCstNode[];
  expression?: ExpressionCstNode[];
  Semicolon: IToken[];
  EndParen: IToken[];
  blockableStatement: BlockableStatementCstNode[];
};

export interface GlobalVarDeclarationsStatementCstNode extends CstNode {
  name: 'globalVarDeclarationsStatement';
  children: GlobalVarDeclarationsStatementCstChildren;
}

export type GlobalVarDeclarationsStatementCstChildren = {
  globalVarDeclarations: GlobalVarDeclarationsCstNode[];
  Semicolon?: IToken[];
};

export interface GlobalVarDeclarationsCstNode extends CstNode {
  name: 'globalVarDeclarations';
  children: GlobalVarDeclarationsCstChildren;
}

export type GlobalVarDeclarationsCstChildren = {
  GlobalVar: IToken[];
  globalVarDeclaration: GlobalVarDeclarationCstNode[];
  Comma?: IToken[];
};

export interface GlobalVarDeclarationCstNode extends CstNode {
  name: 'globalVarDeclaration';
  children: GlobalVarDeclarationCstChildren;
}

export type GlobalVarDeclarationCstChildren = {
  Identifier: IToken[];
};

export interface LocalVarDeclarationsStatementCstNode extends CstNode {
  name: 'localVarDeclarationsStatement';
  children: LocalVarDeclarationsStatementCstChildren;
}

export type LocalVarDeclarationsStatementCstChildren = {
  localVarDeclarations: LocalVarDeclarationsCstNode[];
  Semicolon?: IToken[];
};

export interface LocalVarDeclarationsCstNode extends CstNode {
  name: 'localVarDeclarations';
  children: LocalVarDeclarationsCstChildren;
}

export type LocalVarDeclarationsCstChildren = {
  Var: IToken[];
  localVarDeclaration: LocalVarDeclarationCstNode[];
  Comma?: IToken[];
};

export interface LocalVarDeclarationCstNode extends CstNode {
  name: 'localVarDeclaration';
  children: LocalVarDeclarationCstChildren;
}

export type LocalVarDeclarationCstChildren = {
  Identifier: IToken[];
  Assign?: IToken[];
  assignmentRightHandSide?: AssignmentRightHandSideCstNode[];
};

export interface StaticVarDeclarationStatementCstNode extends CstNode {
  name: 'staticVarDeclarationStatement';
  children: StaticVarDeclarationStatementCstChildren;
}

export type StaticVarDeclarationStatementCstChildren = {
  staticVarDeclarations: StaticVarDeclarationsCstNode[];
  Semicolon?: IToken[];
};

export interface StaticVarDeclarationsCstNode extends CstNode {
  name: 'staticVarDeclarations';
  children: StaticVarDeclarationsCstChildren;
}

export type StaticVarDeclarationsCstChildren = {
  Static: IToken[];
  Identifier: IToken[];
  Assign: IToken[];
  assignmentRightHandSide: AssignmentRightHandSideCstNode[];
};

export interface VariableAssignmentStatementCstNode extends CstNode {
  name: 'variableAssignmentStatement';
  children: VariableAssignmentStatementCstChildren;
}

export type VariableAssignmentStatementCstChildren = {
  variableAssignment: VariableAssignmentCstNode[];
  Semicolon?: IToken[];
};

export interface VariableAssignmentCstNode extends CstNode {
  name: 'variableAssignment';
  children: VariableAssignmentCstChildren;
}

export type VariableAssignmentCstChildren = {
  Identifier: IToken[];
  Assign: IToken[];
  assignmentRightHandSide: AssignmentRightHandSideCstNode[];
};

export interface AssignmentCstNode extends CstNode {
  name: 'assignment';
  children: AssignmentCstChildren;
}

export type AssignmentCstChildren = {
  AssignmentOperator: IToken[];
  assignmentRightHandSide: AssignmentRightHandSideCstNode[];
};

export interface AssignmentRightHandSideCstNode extends CstNode {
  name: 'assignmentRightHandSide';
  children: AssignmentRightHandSideCstChildren;
}

export type AssignmentRightHandSideCstChildren = {
  expression?: ExpressionCstNode[];
  structLiteral?: StructLiteralCstNode[];
  functionExpression?: FunctionExpressionCstNode[];
};

export interface ArrayLiteralCstNode extends CstNode {
  name: 'arrayLiteral';
  children: ArrayLiteralCstChildren;
}

export type ArrayLiteralCstChildren = {
  StartBracket: IToken[];
  assignmentRightHandSide?: AssignmentRightHandSideCstNode[];
  Comma?: IToken[];
  EndBracket: IToken[];
};

export interface StructLiteralCstNode extends CstNode {
  name: 'structLiteral';
  children: StructLiteralCstChildren;
}

export type StructLiteralCstChildren = {
  StartBrace: IToken[];
  structLiteralEntry?: StructLiteralEntryCstNode[];
  Comma?: IToken[];
  EndBrace: IToken[];
};

export interface StructLiteralEntryCstNode extends CstNode {
  name: 'structLiteralEntry';
  children: StructLiteralEntryCstChildren;
}

export type StructLiteralEntryCstChildren = {
  jsdoc?: JsdocCstNode[];
  Identifier?: IToken[];
  stringLiteral?: StringLiteralCstNode[];
  Colon?: IToken[];
  assignmentRightHandSide?: AssignmentRightHandSideCstNode[];
};

export interface WhileStatementCstNode extends CstNode {
  name: 'whileStatement';
  children: WhileStatementCstChildren;
}

export type WhileStatementCstChildren = {
  While: IToken[];
  expression: ExpressionCstNode[];
  blockableStatement: BlockableStatementCstNode[];
};

export interface DoUntilStatementCstNode extends CstNode {
  name: 'doUntilStatement';
  children: DoUntilStatementCstChildren;
}

export type DoUntilStatementCstChildren = {
  Do: IToken[];
  blockableStatement: BlockableStatementCstNode[];
  Until: IToken[];
  expression: ExpressionCstNode[];
};

export interface SwitchStatementCstNode extends CstNode {
  name: 'switchStatement';
  children: SwitchStatementCstChildren;
}

export type SwitchStatementCstChildren = {
  Switch: IToken[];
  expression: ExpressionCstNode[];
  StartBrace: IToken[];
  caseStatement?: CaseStatementCstNode[];
  defaultStatement?: DefaultStatementCstNode[];
  EndBrace: IToken[];
};

export interface CaseStatementCstNode extends CstNode {
  name: 'caseStatement';
  children: CaseStatementCstChildren;
}

export type CaseStatementCstChildren = {
  Case: IToken[];
  expression: ExpressionCstNode[];
  Colon: IToken[];
  blockableStatements: BlockableStatementsCstNode[];
};

export interface DefaultStatementCstNode extends CstNode {
  name: 'defaultStatement';
  children: DefaultStatementCstChildren;
}

export type DefaultStatementCstChildren = {
  Default: IToken[];
  Colon: IToken[];
  blockableStatements: BlockableStatementsCstNode[];
};

export interface BreakStatementCstNode extends CstNode {
  name: 'breakStatement';
  children: BreakStatementCstChildren;
}

export type BreakStatementCstChildren = {
  Break: IToken[];
  Semicolon?: IToken[];
};

export interface ContinueStatementCstNode extends CstNode {
  name: 'continueStatement';
  children: ContinueStatementCstChildren;
}

export type ContinueStatementCstChildren = {
  Continue: IToken[];
  Semicolon?: IToken[];
};

export interface ExitStatementCstNode extends CstNode {
  name: 'exitStatement';
  children: ExitStatementCstChildren;
}

export type ExitStatementCstChildren = {
  Exit: IToken[];
  Semicolon?: IToken[];
};

export interface WithStatementCstNode extends CstNode {
  name: 'withStatement';
  children: WithStatementCstChildren;
}

export type WithStatementCstChildren = {
  With: IToken[];
  expression: ExpressionCstNode[];
  blockableStatement: BlockableStatementCstNode[];
};

export interface TryStatementCstNode extends CstNode {
  name: 'tryStatement';
  children: TryStatementCstChildren;
}

export type TryStatementCstChildren = {
  Try: IToken[];
  blockStatement: BlockStatementCstNode[];
  catchStatement?: CatchStatementCstNode[];
  Finally?: IToken[];
};

export interface CatchStatementCstNode extends CstNode {
  name: 'catchStatement';
  children: CatchStatementCstChildren;
}

export type CatchStatementCstChildren = {
  Catch: IToken[];
  StartParen: IToken[];
  Identifier: IToken[];
  EndParen: IToken[];
  blockStatement: BlockStatementCstNode[];
};

export interface GmlVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  file(children: FileCstChildren, param?: IN): OUT;
  statements(children: StatementsCstChildren, param?: IN): OUT;
  statement(children: StatementCstChildren, param?: IN): OUT;
  jsdoc(children: JsdocCstChildren, param?: IN): OUT;
  jsdocGml(children: JsdocGmlCstChildren, param?: IN): OUT;
  jsdocJs(children: JsdocJsCstChildren, param?: IN): OUT;
  stringLiteral(children: StringLiteralCstChildren, param?: IN): OUT;
  multilineDoubleStringLiteral(
    children: MultilineDoubleStringLiteralCstChildren,
    param?: IN,
  ): OUT;
  multilineSingleStringLiteral(
    children: MultilineSingleStringLiteralCstChildren,
    param?: IN,
  ): OUT;
  templateLiteral(children: TemplateLiteralCstChildren, param?: IN): OUT;
  repeatStatement(children: RepeatStatementCstChildren, param?: IN): OUT;
  returnStatement(children: ReturnStatementCstChildren, param?: IN): OUT;
  ifStatement(children: IfStatementCstChildren, param?: IN): OUT;
  elseIfStatement(children: ElseIfStatementCstChildren, param?: IN): OUT;
  elseStatement(children: ElseStatementCstChildren, param?: IN): OUT;
  blockableStatement(children: BlockableStatementCstChildren, param?: IN): OUT;
  blockableStatements(
    children: BlockableStatementsCstChildren,
    param?: IN,
  ): OUT;
  blockStatement(children: BlockStatementCstChildren, param?: IN): OUT;
  expressionStatement(
    children: ExpressionStatementCstChildren,
    param?: IN,
  ): OUT;
  expression(children: ExpressionCstChildren, param?: IN): OUT;
  binaryExpression(children: BinaryExpressionCstChildren, param?: IN): OUT;
  ternaryExpression(children: TernaryExpressionCstChildren, param?: IN): OUT;
  primaryExpression(children: PrimaryExpressionCstChildren, param?: IN): OUT;
  identifier(children: IdentifierCstChildren, param?: IN): OUT;
  identifierAccessor(children: IdentifierAccessorCstChildren, param?: IN): OUT;
  parenthesizedExpression(
    children: ParenthesizedExpressionCstChildren,
    param?: IN,
  ): OUT;
  accessorSuffixes(children: AccessorSuffixesCstChildren, param?: IN): OUT;
  dotAccessSuffix(children: DotAccessSuffixCstChildren, param?: IN): OUT;
  arrayAccessSuffix(children: ArrayAccessSuffixCstChildren, param?: IN): OUT;
  structAccessSuffix(children: StructAccessSuffixCstChildren, param?: IN): OUT;
  listAccessSuffix(children: ListAccessSuffixCstChildren, param?: IN): OUT;
  mapAccessSuffix(children: MapAccessSuffixCstChildren, param?: IN): OUT;
  gridAccessSuffix(children: GridAccessSuffixCstChildren, param?: IN): OUT;
  arrayMutationAccessorSuffix(
    children: ArrayMutationAccessorSuffixCstChildren,
    param?: IN,
  ): OUT;
  functionArguments(children: FunctionArgumentsCstChildren, param?: IN): OUT;
  functionArgument(children: FunctionArgumentCstChildren, param?: IN): OUT;
  emptyStatement(children: EmptyStatementCstChildren, param?: IN): OUT;
  enumStatement(children: EnumStatementCstChildren, param?: IN): OUT;
  enumMember(children: EnumMemberCstChildren, param?: IN): OUT;
  constructorSuffix(children: ConstructorSuffixCstChildren, param?: IN): OUT;
  functionExpression(children: FunctionExpressionCstChildren, param?: IN): OUT;
  functionStatement(children: FunctionStatementCstChildren, param?: IN): OUT;
  functionParameters(children: FunctionParametersCstChildren, param?: IN): OUT;
  functionParameter(children: FunctionParameterCstChildren, param?: IN): OUT;
  macroStatement(children: MacroStatementCstChildren, param?: IN): OUT;
  forStatement(children: ForStatementCstChildren, param?: IN): OUT;
  globalVarDeclarationsStatement(
    children: GlobalVarDeclarationsStatementCstChildren,
    param?: IN,
  ): OUT;
  globalVarDeclarations(
    children: GlobalVarDeclarationsCstChildren,
    param?: IN,
  ): OUT;
  globalVarDeclaration(
    children: GlobalVarDeclarationCstChildren,
    param?: IN,
  ): OUT;
  localVarDeclarationsStatement(
    children: LocalVarDeclarationsStatementCstChildren,
    param?: IN,
  ): OUT;
  localVarDeclarations(
    children: LocalVarDeclarationsCstChildren,
    param?: IN,
  ): OUT;
  localVarDeclaration(
    children: LocalVarDeclarationCstChildren,
    param?: IN,
  ): OUT;
  staticVarDeclarationStatement(
    children: StaticVarDeclarationStatementCstChildren,
    param?: IN,
  ): OUT;
  staticVarDeclarations(
    children: StaticVarDeclarationsCstChildren,
    param?: IN,
  ): OUT;
  variableAssignmentStatement(
    children: VariableAssignmentStatementCstChildren,
    param?: IN,
  ): OUT;
  variableAssignment(children: VariableAssignmentCstChildren, param?: IN): OUT;
  assignment(children: AssignmentCstChildren, param?: IN): OUT;
  assignmentRightHandSide(
    children: AssignmentRightHandSideCstChildren,
    param?: IN,
  ): OUT;
  arrayLiteral(children: ArrayLiteralCstChildren, param?: IN): OUT;
  structLiteral(children: StructLiteralCstChildren, param?: IN): OUT;
  structLiteralEntry(children: StructLiteralEntryCstChildren, param?: IN): OUT;
  whileStatement(children: WhileStatementCstChildren, param?: IN): OUT;
  doUntilStatement(children: DoUntilStatementCstChildren, param?: IN): OUT;
  switchStatement(children: SwitchStatementCstChildren, param?: IN): OUT;
  caseStatement(children: CaseStatementCstChildren, param?: IN): OUT;
  defaultStatement(children: DefaultStatementCstChildren, param?: IN): OUT;
  breakStatement(children: BreakStatementCstChildren, param?: IN): OUT;
  continueStatement(children: ContinueStatementCstChildren, param?: IN): OUT;
  exitStatement(children: ExitStatementCstChildren, param?: IN): OUT;
  withStatement(children: WithStatementCstChildren, param?: IN): OUT;
  tryStatement(children: TryStatementCstChildren, param?: IN): OUT;
  catchStatement(children: CatchStatementCstChildren, param?: IN): OUT;
}
