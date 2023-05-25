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
  JsdocGmlStart: IToken[];
  jsdocLine: JsdocLineCstNode[];
  JsdocGmlLineEnd: IToken[];
};

export interface JsdocJsCstNode extends CstNode {
  name: 'jsdocJs';
  children: JsdocJsCstChildren;
}

export type JsdocJsCstChildren = {
  JsdocJsStart: IToken[];
  jsdocLine?: JsdocLineCstNode[];
  JsdocJsLineStart?: IToken[];
  JsdocJsEnd: IToken[];
};

export interface JsdocTypeCstNode extends CstNode {
  name: 'jsdocType';
  children: JsdocTypeCstChildren;
}

export type JsdocTypeCstChildren = {
  JsdocIdentifier: IToken[];
  JsdocStartAngleBracket?: IToken[];
  jsdocTypeUnion?: JsdocTypeUnionCstNode[];
  JsdocEndAngleBracket?: IToken[];
};

export interface JsdocTypeUnionCstNode extends CstNode {
  name: 'jsdocTypeUnion';
  children: JsdocTypeUnionCstChildren;
}

export type JsdocTypeUnionCstChildren = {
  jsdocType: JsdocTypeCstNode[];
  JsdocPipe?: IToken[];
};

export interface JsdocTypeGroupCstNode extends CstNode {
  name: 'jsdocTypeGroup';
  children: JsdocTypeGroupCstChildren;
}

export type JsdocTypeGroupCstChildren = {
  JsdocStartBrace: IToken[];
  jsdocTypeUnion: JsdocTypeUnionCstNode[];
  JsdocEndBrace: IToken[];
};

export interface JsdocUnstructuredContentCstNode extends CstNode {
  name: 'jsdocUnstructuredContent';
  children: JsdocUnstructuredContentCstChildren;
}

export type JsdocUnstructuredContentCstChildren = {
  Jsdoc?: IToken[];
  Literal?: IToken[];
  JsdocTag?: IToken[];
};

export interface JsdocParamTagCstNode extends CstNode {
  name: 'jsdocParamTag';
  children: JsdocParamTagCstChildren;
}

export type JsdocParamTagCstChildren = {
  JsdocParamTag: IToken[];
  jsdocTypeGroup?: JsdocTypeGroupCstNode[];
  JsdocIdentifier?: IToken[];
  JsdocStartSquareBracket?: IToken[];
  jsdocRemainingParams?: JsdocRemainingParamsCstNode[];
  JsdocEquals?: IToken[];
  Literal?: IToken[];
  JsdocEndSquareBracket?: IToken[];
};

export interface JsdocReturnTagCstNode extends CstNode {
  name: 'jsdocReturnTag';
  children: JsdocReturnTagCstChildren;
}

export type JsdocReturnTagCstChildren = {
  JsdocReturnTag: IToken[];
  jsdocTypeGroup?: JsdocTypeGroupCstNode[];
};

export interface JsdocSelfTagCstNode extends CstNode {
  name: 'jsdocSelfTag';
  children: JsdocSelfTagCstChildren;
}

export type JsdocSelfTagCstChildren = {
  JsdocSelfTag: IToken[];
  JsdocIdentifier: IToken[];
};

export interface JsdocDescriptionTagCstNode extends CstNode {
  name: 'jsdocDescriptionTag';
  children: JsdocDescriptionTagCstChildren;
}

export type JsdocDescriptionTagCstChildren = {
  JsdocDescriptionTag: IToken[];
};

export interface JsdocFunctionTagCstNode extends CstNode {
  name: 'jsdocFunctionTag';
  children: JsdocFunctionTagCstChildren;
}

export type JsdocFunctionTagCstChildren = {
  JsdocFunctionTag: IToken[];
};

export interface JsdocPureTagCstNode extends CstNode {
  name: 'jsdocPureTag';
  children: JsdocPureTagCstChildren;
}

export type JsdocPureTagCstChildren = {
  JsdocPureTag: IToken[];
};

export interface JsdocIgnoreTagCstNode extends CstNode {
  name: 'jsdocIgnoreTag';
  children: JsdocIgnoreTagCstChildren;
}

export type JsdocIgnoreTagCstChildren = {
  JsdocIgnoreTag: IToken[];
};

export interface JsdocDeprecatedTagCstNode extends CstNode {
  name: 'jsdocDeprecatedTag';
  children: JsdocDeprecatedTagCstChildren;
}

export type JsdocDeprecatedTagCstChildren = {
  JsdocDeprecatedTag: IToken[];
};

export interface JsdocUnknownTagCstNode extends CstNode {
  name: 'jsdocUnknownTag';
  children: JsdocUnknownTagCstChildren;
}

export type JsdocUnknownTagCstChildren = {
  JsdocUnknownTag: IToken[];
};

export interface JsdocRemainingParamsCstNode extends CstNode {
  name: 'jsdocRemainingParams';
  children: JsdocRemainingParamsCstChildren;
}

export type JsdocRemainingParamsCstChildren = {
  JsdocDot: IToken[];
};

export interface JsdocTagCstNode extends CstNode {
  name: 'jsdocTag';
  children: JsdocTagCstChildren;
}

export type JsdocTagCstChildren = {
  jsdocParamTag?: JsdocParamTagCstNode[];
  jsdocReturnTag?: JsdocReturnTagCstNode[];
  jsdocSelfTag?: JsdocSelfTagCstNode[];
  jsdocDescriptionTag?: JsdocDescriptionTagCstNode[];
  jsdocFunctionTag?: JsdocFunctionTagCstNode[];
  jsdocPureTag?: JsdocPureTagCstNode[];
  jsdocIgnoreTag?: JsdocIgnoreTagCstNode[];
  jsdocDeprecatedTag?: JsdocDeprecatedTagCstNode[];
  jsdocUnknownTag?: JsdocUnknownTagCstNode[];
};

export interface JsdocLineCstNode extends CstNode {
  name: 'jsdocLine';
  children: JsdocLineCstChildren;
}

export type JsdocLineCstChildren = {
  jsdocTag?: JsdocTagCstNode[];
  jsdocUnstructuredContent: JsdocUnstructuredContentCstNode[];
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
  variableAssignment?: VariableAssignmentCstNode[];
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
  Literal?: IToken[];
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
  identifier: IdentifierCstNode[];
  accessorSuffixes?: AccessorSuffixesCstNode[];
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
  arrayAccessSuffix?: ArrayAccessSuffixCstNode[];
  structAccessSuffix?: StructAccessSuffixCstNode[];
  listAccessSuffix?: ListAccessSuffixCstNode[];
  mapAccessSuffix?: MapAccessSuffixCstNode[];
  gridAccessSuffix?: GridAccessSuffixCstNode[];
  arrayMutationAccessorSuffix?: ArrayMutationAccessorSuffixCstNode[];
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
  Escape?: IToken[];
  assignmentRightHandSide: AssignmentRightHandSideCstNode[];
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

export interface VariableAssignmentCstNode extends CstNode {
  name: 'variableAssignment';
  children: VariableAssignmentCstChildren;
}

export type VariableAssignmentCstChildren = {
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
  statements: StatementsCstNode[];
};

export interface DefaultStatementCstNode extends CstNode {
  name: 'defaultStatement';
  children: DefaultStatementCstChildren;
}

export type DefaultStatementCstChildren = {
  Default: IToken[];
  Colon: IToken[];
  statements: StatementsCstNode[];
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
  Catch?: IToken[];
  StartParen?: IToken[];
  Identifier?: IToken[];
  EndParen?: IToken[];
  Finally?: IToken[];
};

export interface GmlVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  file(children: FileCstChildren, param?: IN): OUT;
  statements(children: StatementsCstChildren, param?: IN): OUT;
  statement(children: StatementCstChildren, param?: IN): OUT;
  jsdoc(children: JsdocCstChildren, param?: IN): OUT;
  jsdocGml(children: JsdocGmlCstChildren, param?: IN): OUT;
  jsdocJs(children: JsdocJsCstChildren, param?: IN): OUT;
  jsdocType(children: JsdocTypeCstChildren, param?: IN): OUT;
  jsdocTypeUnion(children: JsdocTypeUnionCstChildren, param?: IN): OUT;
  jsdocTypeGroup(children: JsdocTypeGroupCstChildren, param?: IN): OUT;
  jsdocUnstructuredContent(
    children: JsdocUnstructuredContentCstChildren,
    param?: IN,
  ): OUT;
  jsdocParamTag(children: JsdocParamTagCstChildren, param?: IN): OUT;
  jsdocReturnTag(children: JsdocReturnTagCstChildren, param?: IN): OUT;
  jsdocSelfTag(children: JsdocSelfTagCstChildren, param?: IN): OUT;
  jsdocDescriptionTag(
    children: JsdocDescriptionTagCstChildren,
    param?: IN,
  ): OUT;
  jsdocFunctionTag(children: JsdocFunctionTagCstChildren, param?: IN): OUT;
  jsdocPureTag(children: JsdocPureTagCstChildren, param?: IN): OUT;
  jsdocIgnoreTag(children: JsdocIgnoreTagCstChildren, param?: IN): OUT;
  jsdocDeprecatedTag(children: JsdocDeprecatedTagCstChildren, param?: IN): OUT;
  jsdocUnknownTag(children: JsdocUnknownTagCstChildren, param?: IN): OUT;
  jsdocRemainingParams(
    children: JsdocRemainingParamsCstChildren,
    param?: IN,
  ): OUT;
  jsdocTag(children: JsdocTagCstChildren, param?: IN): OUT;
  jsdocLine(children: JsdocLineCstChildren, param?: IN): OUT;
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
  variableAssignment(children: VariableAssignmentCstChildren, param?: IN): OUT;
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
}
