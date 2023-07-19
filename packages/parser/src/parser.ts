import { keysOf } from '@bscotch/utility';
import {
  CstParser,
  type CstNode,
  type CstNodeLocation,
  type ILexingResult,
  type IToken,
} from 'chevrotain';
import type {
  AccessorSuffixesCstChildren,
  AccessorSuffixesCstNode,
  FunctionArgumentCstNode,
  FunctionArgumentsCstNode,
  GmlVisitor,
  IdentifierCstChildren,
  IdentifierCstNode,
  MultilineDoubleStringLiteralCstChildren,
  MultilineSingleStringLiteralCstChildren,
  StringLiteralCstChildren,
} from '../gml-cst.js';
import type { JsdocSummary } from './jsdoc.js';
import { GmlLexer } from './lexer.js';
import type { GmlParseError } from './project.diagnostics.js';
import { Reference, ReferenceableType } from './project.location.js';
import { Signifier } from './signifiers.js';
import { c, categories, t, tokens } from './tokens.js';
import { Type, TypeStore } from './types.js';
import { ok } from './util.js';

export interface GmlParsed {
  lexed: ILexingResult;
  cst: CstNode;
  errors: GmlParseError[];
}

export type IdentifierSource =
  | IdentifierCstChildren
  | IdentifierCstNode
  | IdentifierCstNode[]
  | { identifier: IdentifierCstNode[] }
  | { children: { identifier: IdentifierCstNode[] } };

type AccessorSuffixName = keyof AccessorSuffixesCstChildren;
export type SortedAccessorSuffix<
  T extends AccessorSuffixName = AccessorSuffixName,
> = Required<AccessorSuffixesCstChildren>[T][0];

export function isEmpty(obj: {}) {
  return Object.keys(obj).length === 0;
}

export function sortedFunctionCallParts(
  node: FunctionArgumentsCstNode,
): (IToken | FunctionArgumentCstNode)[] {
  return [
    node.children.StartParen[0],
    ...(node.children.functionArgument || []),
    ...(node.children.Comma || []),
    node.children.EndParen[0],
  ].sort((a, b) => {
    const aLocation = ('location' in a ? a.location! : a) as CstNodeLocation;
    const bLocation = ('location' in b ? b.location! : b) as CstNodeLocation;
    return aLocation.startOffset - bLocation.startOffset;
  });
}

export function stringLiteralAsString(
  children:
    | StringLiteralCstChildren
    | MultilineSingleStringLiteralCstChildren
    | MultilineDoubleStringLiteralCstChildren,
): string {
  const start =
    'StringStart' in children
      ? children.StringStart[0].image
      : 'MultilineSingleStringStart' in children
      ? children.MultilineSingleStringStart[0].image
      : children.MultilineDoubleStringStart[0].image;
  const end =
    'StringEnd' in children
      ? children.StringEnd[0].image
      : 'MultilineSingleStringEnd' in children
      ? children.MultilineSingleStringEnd[0].image
      : children.MultilineDoubleStringEnd[0].image;
  return `${start}${(children.Substring || [])
    .map((s) => s.image)
    .join('')}${end}`;
}

function sortItokenRecords(records: Record<string, IToken[]>): IToken[] {
  const sorted: IToken[] = [];
  for (const key of keysOf(records)) {
    sorted.push(...records[key]);
  }
  sorted.sort((a, b) => a.startOffset - b.startOffset);
  return sorted;
}

export function sortedAccessorSuffixes(
  suffixNodes: AccessorSuffixesCstNode[] | undefined,
): SortedAccessorSuffix[] {
  // Convert into a flat array of suffixes, sorted by their position in the source code.
  const sorted: SortedAccessorSuffix[] = [];
  if (!suffixNodes) {
    return sorted;
  }
  for (const node of suffixNodes) {
    const { children } = node;
    const suffixKinds = keysOf(children);
    for (const kind of suffixKinds) {
      ok(children[kind]!.length === 1);
      sorted.push(children[kind]![0]);
    }
  }
  sorted.sort((a, b) => a.location!.startOffset - b.location!.startOffset);
  return sorted;
}

const identifierCstNames = [
  'All',
  'Global',
  'Identifier',
  'Noone',
  'Other',
  'Self',
] as const satisfies readonly (keyof IdentifierCstChildren)[];

export function identifierFrom(nodes: IdentifierSource):
  | {
      token: IToken;
      type: keyof IdentifierCstChildren;
      name: string;
    }
  | undefined {
  let node: IdentifierCstNode;
  if (Array.isArray(nodes)) {
    node = nodes[0];
  } else if ('children' in nodes && 'identifier' in nodes.children) {
    node = nodes.children.identifier[0];
  } else if ('identifier' in nodes) {
    node = nodes.identifier[0];
  } else {
    node = nodes as IdentifierCstNode;
  }
  const children = 'children' in node ? node.children : node;

  const type = identifierCstNames.find((name) => children[name]);
  if (!type) {
    return;
  }
  const token = children[type]![0];
  return { token, type, name: token.image };
}

export class GmlParser extends CstParser {
  /** Parse GML Code, e.g. from a file. */
  parse(code: string): GmlParsed {
    const lexed = this.lexer.tokenize(code);
    this.input = lexed.tokens;
    const cst = this.file();
    return {
      lexed,
      cst,
      errors: this.errors,
    };
  }

  readonly lexer = GmlLexer;

  readonly file = this.RULE('file', () => {
    this.SUBRULE(this.statements);
  });

  optionallyConsumeSemicolon() {
    this.OPTION9(() => this.CONSUME(t.Semicolon));
  }

  readonly statements = this.RULE('statements', () => {
    this.MANY(() => this.SUBRULE(this.statement));
  });

  readonly statement = this.RULE('statement', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.functionStatement) },
      { ALT: () => this.SUBRULE(this.localVarDeclarationsStatement) },
      { ALT: () => this.SUBRULE(this.globalVarDeclarationsStatement) },
      { ALT: () => this.SUBRULE(this.staticVarDeclarationStatement) },
      { ALT: () => this.SUBRULE(this.variableAssignmentStatement) },
      { ALT: () => this.SUBRULE(this.ifStatement) },
      { ALT: () => this.SUBRULE(this.tryStatement) },
      { ALT: () => this.SUBRULE(this.whileStatement) },
      { ALT: () => this.SUBRULE(this.forStatement) },
      { ALT: () => this.SUBRULE(this.doUntilStatement) },
      { ALT: () => this.SUBRULE(this.switchStatement) },
      { ALT: () => this.SUBRULE(this.breakStatement) },
      { ALT: () => this.SUBRULE(this.continueStatement) },
      { ALT: () => this.SUBRULE(this.returnStatement) },
      { ALT: () => this.SUBRULE(this.exitStatement) },
      { ALT: () => this.SUBRULE(this.withStatement) },
      { ALT: () => this.SUBRULE(this.enumStatement) },
      { ALT: () => this.SUBRULE(this.macroStatement) },
      { ALT: () => this.SUBRULE(this.emptyStatement) },
      { ALT: () => this.SUBRULE(this.repeatStatement) },
      { ALT: () => this.SUBRULE(this.expressionStatement) },
      { ALT: () => this.SUBRULE(this.jsdoc) },
    ]);
  });

  readonly jsdoc = this.RULE('jsdoc', () => {
    this.OR2([
      { ALT: () => this.SUBRULE(this.jsdocGml) },
      { ALT: () => this.SUBRULE(this.jsdocJs) },
    ]);
  });

  readonly jsdocGml = this.RULE('jsdocGml', () => {
    this.AT_LEAST_ONE(() => {
      this.CONSUME(t.JsdocGmlLine);
    });
  });

  readonly jsdocJs = this.RULE('jsdocJs', () => {
    this.CONSUME(t.JsdocJs);
  });

  readonly stringLiteral = this.RULE('stringLiteral', () => {
    this.CONSUME(t.StringStart);
    this.MANY(() => {
      this.CONSUME(c.Substring);
    });
    this.CONSUME(t.StringEnd);
  });

  readonly multilineDoubleStringLiteral = this.RULE(
    'multilineDoubleStringLiteral',
    () => {
      this.CONSUME(t.MultilineDoubleStringStart);
      this.MANY(() => {
        this.CONSUME(c.Substring);
      });
      this.CONSUME(t.MultilineDoubleStringEnd);
    },
  );

  readonly multilineSingleStringLiteral = this.RULE(
    'multilineSingleStringLiteral',
    () => {
      this.CONSUME(t.MultilineSingleStringStart);
      this.MANY(() => {
        this.CONSUME(c.Substring);
      });
      this.CONSUME(t.MultilineSingleStringEnd);
    },
  );

  readonly templateLiteral = this.RULE('templateLiteral', () => {
    this.CONSUME(t.TemplateStart);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(c.Substring) },
        {
          ALT: () => {
            this.CONSUME(t.TemplateInterpStart);
            this.SUBRULE(this.expression);
            this.CONSUME(t.EndBrace);
          },
        },
      ]);
    });
    this.CONSUME(t.TemplateStringEnd);
  });

  readonly repeatStatement = this.RULE('repeatStatement', () => {
    this.CONSUME(t.Repeat);
    this.SUBRULE(this.expression);
    this.SUBRULE(this.blockableStatement);
  });

  readonly returnStatement = this.RULE('returnStatement', () => {
    this.CONSUME(t.Return);
    this.OPTION1(() => this.SUBRULE(this.assignmentRightHandSide));
    this.OPTION2(() => this.CONSUME(t.Semicolon));
  });

  readonly ifStatement = this.RULE('ifStatement', () => {
    this.CONSUME(t.If);
    this.SUBRULE(this.expression);
    this.SUBRULE(this.blockableStatement);
    this.MANY(() => this.SUBRULE2(this.elseIfStatement));
    this.OPTION(() => {
      this.SUBRULE(this.elseStatement);
    });
  });

  readonly elseIfStatement = this.RULE('elseIfStatement', () => {
    this.CONSUME(t.Else);
    this.CONSUME(t.If);
    this.SUBRULE(this.expression);
    this.SUBRULE(this.blockableStatement);
  });

  readonly elseStatement = this.RULE('elseStatement', () => {
    this.CONSUME(t.Else);
    this.SUBRULE2(this.blockableStatement);
  });

  readonly blockableStatement = this.RULE('blockableStatement', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.statement) },
      { ALT: () => this.SUBRULE(this.blockStatement) },
    ]);
  });

  readonly blockStatement = this.RULE('blockStatement', () => {
    this.CONSUME(t.StartBrace);
    this.MANY(() => this.SUBRULE(this.statement));
    this.CONSUME(t.EndBrace);
  });

  readonly expressionStatement = this.RULE('expressionStatement', () => {
    this.SUBRULE(this.expression);
    this.optionallyConsumeSemicolon();
  });

  readonly expression = this.RULE('expression', () => {
    this.SUBRULE(this.primaryExpression);
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.assignment) },
        {
          ALT: () =>
            this.AT_LEAST_ONE(() => this.SUBRULE2(this.binaryExpression)),
        },
        { ALT: () => this.SUBRULE(this.ternaryExpression) },
      ]);
    });
  });

  readonly binaryExpression = this.RULE('binaryExpression', () => {
    this.CONSUME(c.BinaryOperator);
    this.SUBRULE(this.assignmentRightHandSide);
  });

  readonly ternaryExpression = this.RULE('ternaryExpression', () => {
    this.CONSUME(t.QuestionMark);
    this.SUBRULE(this.assignmentRightHandSide);
    this.CONSUME(t.Colon);
    this.SUBRULE2(this.assignmentRightHandSide);
  });

  readonly primaryExpression = this.RULE('primaryExpression', () => {
    this.OPTION1(() => this.CONSUME(c.UnaryPrefixOperator));
    this.OR1([
      { ALT: () => this.CONSUME(c.BooleanLiteral) },
      { ALT: () => this.CONSUME(c.NumericLiteral) },
      { ALT: () => this.CONSUME(c.PointerLiteral) },
      { ALT: () => this.CONSUME(t.Undefined) },
      { ALT: () => this.CONSUME(t.NaN) },
      { ALT: () => this.SUBRULE(this.stringLiteral) },
      { ALT: () => this.SUBRULE(this.multilineDoubleStringLiteral) },
      { ALT: () => this.SUBRULE(this.multilineSingleStringLiteral) },
      { ALT: () => this.SUBRULE(this.templateLiteral) },
      { ALT: () => this.SUBRULE(this.identifierAccessor) },
      { ALT: () => this.SUBRULE(this.parenthesizedExpression) },
      { ALT: () => this.SUBRULE(this.arrayLiteral) },
    ]);
    this.OPTION2(() => this.CONSUME(c.UnarySuffixOperator));
  });

  readonly identifier = this.RULE('identifier', () => {
    this.OR([
      { ALT: () => this.CONSUME(t.Identifier) },
      { ALT: () => this.CONSUME(t.Self) },
      { ALT: () => this.CONSUME(t.Other) },
      { ALT: () => this.CONSUME(t.Global) },
      { ALT: () => this.CONSUME(t.Noone) },
      { ALT: () => this.CONSUME(t.All) },
    ]);
  });

  readonly identifierAccessor = this.RULE('identifierAccessor', () => {
    this.OPTION(() => {
      this.CONSUME(t.New);
    });
    this.SUBRULE(this.identifier);
    this.MANY(() => {
      this.SUBRULE(this.accessorSuffixes);
    });
    this.OPTION2(() => {
      this.SUBRULE(this.assignment);
    });
  });

  readonly parenthesizedExpression = this.RULE(
    'parenthesizedExpression',
    () => {
      this.CONSUME(t.StartParen);
      this.SUBRULE(this.expression);
      this.CONSUME(t.EndParen);
    },
  );

  readonly accessorSuffixes = this.RULE('accessorSuffixes', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.gridAccessorSuffix) },
      { ALT: () => this.SUBRULE(this.structAccessorSuffix) },
      { ALT: () => this.SUBRULE(this.listAccessorSuffix) },
      { ALT: () => this.SUBRULE(this.mapAccessorSuffix) },
      { ALT: () => this.SUBRULE(this.arrayMutationAccessorSuffix) },
      { ALT: () => this.SUBRULE(this.arrayAccessSuffix) },
      { ALT: () => this.SUBRULE(this.dotAccessSuffix) },
      { ALT: () => this.SUBRULE(this.functionArguments) },
    ]);
  });

  readonly dotAccessSuffix = this.RULE('dotAccessSuffix', () => {
    this.CONSUME(t.Dot);
    this.SUBRULE(this.identifier);
  });

  readonly arrayAccessSuffix = this.RULE('arrayAccessSuffix', () => {
    this.CONSUME(t.StartBracket);
    this.SUBRULE(this.expression);
    // Support for legacy 2D array access
    this.OPTION(() => {
      this.CONSUME(t.Comma);
      this.SUBRULE2(this.expression);
    });
    this.CONSUME(t.EndBracket);
  });

  readonly structAccessorSuffix = this.RULE('structAccessSuffix', () => {
    this.CONSUME(t.StructAccessorStart);
    this.SUBRULE(this.expression);
    this.CONSUME(t.EndBracket);
  });

  readonly listAccessorSuffix = this.RULE('listAccessSuffix', () => {
    this.CONSUME(t.DsListAccessorStart);
    this.SUBRULE(this.expression);
    this.CONSUME(t.EndBracket);
  });

  readonly mapAccessorSuffix = this.RULE('mapAccessSuffix', () => {
    this.CONSUME(t.DsMapAccessorStart);
    this.SUBRULE(this.expression);
    this.CONSUME(t.EndBracket);
  });

  readonly gridAccessorSuffix = this.RULE('gridAccessSuffix', () => {
    this.CONSUME(t.DsGridAccessorStart);
    this.SUBRULE(this.expression);
    this.CONSUME(t.Comma);
    this.SUBRULE2(this.expression);
    this.CONSUME(t.EndBracket);
  });

  readonly arrayMutationAccessorSuffix = this.RULE(
    'arrayMutationAccessorSuffix',
    () => {
      this.CONSUME(t.ArrayMutateAccessorStart);
      this.SUBRULE(this.expression);
      this.CONSUME(t.EndBracket);
    },
  );

  readonly functionArguments = this.RULE('functionArguments', () => {
    this.CONSUME(t.StartParen);
    this.OPTION1(() => {
      this.SUBRULE(this.functionArgument);
    });
    this.MANY(() => {
      this.CONSUME(t.Comma);
      this.OPTION2(() => this.SUBRULE2(this.functionArgument));
    });
    this.CONSUME(t.EndParen);
  });

  readonly functionArgument = this.RULE('functionArgument', () => {
    this.OPTION1(() => {
      this.SUBRULE(this.jsdoc);
    });
    this.SUBRULE(this.assignmentRightHandSide);
  });

  readonly emptyStatement = this.RULE('emptyStatement', () => {
    this.CONSUME(t.Semicolon);
  });

  readonly enumStatement = this.RULE('enumStatement', () => {
    this.CONSUME(t.Enum);
    this.CONSUME1(t.Identifier);
    this.CONSUME(t.StartBrace);
    this.SUBRULE(this.enumMember);
    this.MANY(() => {
      this.CONSUME2(t.Comma);
      this.SUBRULE2(this.enumMember);
    });
    this.OPTION(() => this.CONSUME3(t.Comma));
    this.CONSUME(t.EndBrace);
  });

  readonly enumMember = this.RULE('enumMember', () => {
    this.CONSUME(t.Identifier);
    this.OPTION(() => {
      this.CONSUME(t.Assign);
      this.OPTION2(() => this.CONSUME(t.Minus));
      this.CONSUME(c.NumericLiteral);
    });
  });

  readonly constructorSuffix = this.RULE('constructorSuffix', () => {
    this.OPTION(() => {
      this.CONSUME(t.Colon);
      this.CONSUME(t.Identifier);
      this.SUBRULE(this.functionArguments);
    });
    this.CONSUME(t.Constructor);
  });

  readonly functionExpression = this.RULE('functionExpression', () => {
    this.CONSUME(t.Function);
    this.OPTION1(() => this.CONSUME1(t.Identifier));
    this.SUBRULE1(this.functionParameters);
    this.OPTION2(() => {
      this.SUBRULE2(this.constructorSuffix);
    });
    this.SUBRULE(this.blockStatement);
  });

  readonly functionStatement = this.RULE('functionStatement', () => {
    this.SUBRULE(this.functionExpression);
    this.OPTION(() => this.CONSUME(t.Semicolon));
  });

  readonly functionParameters = this.RULE('functionParameters', () => {
    this.CONSUME(t.StartParen);
    this.MANY_SEP({
      SEP: t.Comma,
      DEF: () => this.SUBRULE(this.functionParameter),
    });
    this.CONSUME(t.EndParen);
  });

  readonly functionParameter = this.RULE('functionParameter', () => {
    this.CONSUME(t.Identifier);
    this.OPTION(() => {
      this.CONSUME(t.Assign);
      this.SUBRULE(this.assignmentRightHandSide);
    });
  });

  readonly macroStatement = this.RULE('macroStatement', () => {
    this.CONSUME(t.Macro);
    this.CONSUME(t.Identifier);
    this.OPTION(() => {
      this.CONSUME(t.Escape);
    });
    this.SUBRULE(this.assignmentRightHandSide);
    this.MANY(() => {
      this.CONSUME2(t.Escape);
      this.SUBRULE2(this.assignmentRightHandSide);
    });
  });

  readonly forStatement = this.RULE('forStatement', () => {
    this.CONSUME(t.For);
    this.CONSUME(t.StartParen);
    this.OPTION1(() =>
      this.OR([
        { ALT: () => this.SUBRULE(this.localVarDeclarations) },
        { ALT: () => this.SUBRULE(this.expression) },
      ]),
    );
    this.CONSUME2(t.Semicolon);
    this.OPTION2(() => this.SUBRULE2(this.expression));
    this.CONSUME3(t.Semicolon);
    this.OPTION3(() => this.SUBRULE3(this.expression));
    this.CONSUME(t.EndParen);
    this.SUBRULE(this.blockableStatement);
  });

  readonly globalVarDeclarationsStatement = this.RULE(
    'globalVarDeclarationsStatement',
    () => {
      this.SUBRULE(this.globalVarDeclarations);
      this.optionallyConsumeSemicolon();
    },
  );

  readonly globalVarDeclarations = this.RULE('globalVarDeclarations', () => {
    this.CONSUME(t.GlobalVar);
    this.AT_LEAST_ONE_SEP({
      SEP: t.Comma,
      DEF: () => {
        this.SUBRULE(this.globalVarDeclaration);
      },
    });
  });

  readonly globalVarDeclaration = this.RULE('globalVarDeclaration', () => {
    this.CONSUME(t.Identifier);
  });

  readonly localVarDeclarationsStatement = this.RULE(
    'localVarDeclarationsStatement',
    () => {
      this.SUBRULE(this.localVarDeclarations);
      this.optionallyConsumeSemicolon();
    },
  );

  readonly localVarDeclarations = this.RULE('localVarDeclarations', () => {
    this.CONSUME(t.Var);
    this.AT_LEAST_ONE_SEP({
      SEP: t.Comma,
      DEF: () => {
        this.SUBRULE(this.localVarDeclaration);
      },
    });
  });

  readonly localVarDeclaration = this.RULE('localVarDeclaration', () => {
    this.CONSUME(t.Identifier);
    this.OPTION(() => {
      this.CONSUME(t.Assign);
      this.SUBRULE(this.assignmentRightHandSide);
    });
  });

  readonly staticVarDeclarationStatement = this.RULE(
    'staticVarDeclarationStatement',
    () => {
      this.SUBRULE(this.staticVarDeclaration);
      this.optionallyConsumeSemicolon();
    },
  );

  readonly staticVarDeclaration = this.RULE('staticVarDeclarations', () => {
    this.CONSUME(t.Static);
    this.CONSUME(t.Identifier);
    this.CONSUME(t.Assign);
    this.SUBRULE(this.assignmentRightHandSide);
  });

  // For simple variable assignments (no accessors on the LHS)
  readonly variableAssignmentStatement = this.RULE(
    'variableAssignmentStatement',
    () => {
      this.SUBRULE(this.variableAssignment);
      this.optionallyConsumeSemicolon();
    },
  );

  readonly variableAssignment = this.RULE('variableAssignment', () => {
    this.CONSUME(t.Identifier);
    this.CONSUME(t.Assign);
    this.SUBRULE(this.assignmentRightHandSide);
  });

  readonly assignment = this.RULE('assignment', () => {
    this.CONSUME(c.AssignmentOperator);
    this.SUBRULE(this.assignmentRightHandSide);
  });

  readonly assignmentRightHandSide = this.RULE(
    'assignmentRightHandSide',
    () => {
      this.OR([
        { ALT: () => this.SUBRULE(this.expression) },
        { ALT: () => this.SUBRULE(this.structLiteral) },
        { ALT: () => this.SUBRULE(this.functionExpression) },
      ]);
    },
  );

  readonly arrayLiteral = this.RULE('arrayLiteral', () => {
    this.CONSUME(t.StartBracket);
    this.OPTION(() => {
      this.SUBRULE(this.assignmentRightHandSide);
      this.MANY(() => {
        this.CONSUME1(t.Comma);
        this.SUBRULE2(this.assignmentRightHandSide);
      });
      this.OPTION2(() => this.CONSUME2(t.Comma));
    });
    this.CONSUME(t.EndBracket);
  });

  readonly structLiteral = this.RULE('structLiteral', () => {
    this.CONSUME(t.StartBrace);
    this.OPTION1(() => {
      this.SUBRULE1(this.structLiteralEntry);
      this.MANY(() => {
        this.CONSUME1(t.Comma);
        this.SUBRULE2(this.structLiteralEntry);
      });
      this.OPTION2(() => this.CONSUME2(t.Comma));
    });
    this.CONSUME(t.EndBrace);
  });

  readonly structLiteralEntry = this.RULE('structLiteralEntry', () => {
    this.OR([
      {
        ALT: () => {
          this.OPTION(() => {
            this.SUBRULE(this.jsdoc);
          });
          this.CONSUME(t.Identifier);
        },
      },
      { ALT: () => this.SUBRULE(this.stringLiteral) },
    ]);
    this.OPTION1(() => {
      this.CONSUME(t.Colon);
      this.SUBRULE(this.assignmentRightHandSide);
    });
  });

  readonly whileStatement = this.RULE('whileStatement', () => {
    this.CONSUME(t.While);
    this.SUBRULE(this.expression);
    this.SUBRULE(this.blockableStatement);
  });

  readonly doUntilStatement = this.RULE('doUntilStatement', () => {
    this.CONSUME(t.Do);
    this.SUBRULE(this.blockableStatement);
    this.CONSUME(t.Until);
    this.SUBRULE(this.expression);
  });

  readonly switchStatement = this.RULE('switchStatement', () => {
    this.CONSUME(t.Switch);
    this.SUBRULE(this.expression);
    this.CONSUME(t.StartBrace);
    this.MANY(() => this.SUBRULE(this.caseStatement));
    this.OPTION(() => this.SUBRULE(this.defaultStatement));
    this.CONSUME(t.EndBrace);
  });

  readonly caseStatement = this.RULE('caseStatement', () => {
    this.CONSUME(t.Case);
    this.SUBRULE(this.expression);
    this.CONSUME(t.Colon);
    this.SUBRULE(this.statements);
  });

  readonly defaultStatement = this.RULE('defaultStatement', () => {
    this.CONSUME(t.Default);
    this.CONSUME(t.Colon);
    this.SUBRULE(this.statements);
  });

  readonly breakStatement = this.RULE('breakStatement', () => {
    this.CONSUME(t.Break);
    this.optionallyConsumeSemicolon();
  });

  readonly continueStatement = this.RULE('continueStatement', () => {
    this.CONSUME(t.Continue);
    this.optionallyConsumeSemicolon();
  });

  readonly exitStatement = this.RULE('exitStatement', () => {
    this.CONSUME(t.Exit);
    this.optionallyConsumeSemicolon();
  });

  readonly withStatement = this.RULE('withStatement', () => {
    this.CONSUME(t.With);
    this.SUBRULE(this.expression);
    this.SUBRULE(this.blockableStatement);
  });

  readonly tryStatement = this.RULE('tryStatement', () => {
    this.CONSUME(t.Try);
    this.SUBRULE(this.blockStatement);
    this.OPTION1(() => {
      this.CONSUME(t.Catch);
      this.CONSUME(t.StartParen);
      this.CONSUME(t.Identifier);
      this.CONSUME(t.EndParen);
      this.SUBRULE2(this.blockStatement);
    });
    this.OPTION2(() => {
      this.CONSUME(t.Finally);
      this.SUBRULE3(this.blockStatement);
    });
  });

  constructor() {
    super([...tokens, ...categories], {
      nodeLocationTracking: 'full',
      recoveryEnabled: true,
      skipValidations: true,
    });
    this.performSelfAnalysis();
  }

  static jsonify(cst: CstNode): string {
    return JSON.stringify(
      cst,
      (key, val) => {
        if (key === 'tokenType') {
          return {
            name: val.name,
            categories: val.CATEGORIES.map((c: any) => c.name),
            isParent: val.isParent,
          };
        }
        return val;
      },
      2,
    );
  }
}

export type NodeContextKind =
  | 'withCondition'
  | 'withBody'
  | 'functionParam'
  | 'functionArg'
  | 'functionBody'
  | 'functionReturn'
  | 'functionStatement'
  | 'template'
  | 'arrayMember'
  | 'assignment';

export interface Docs {
  type: Type[];
  jsdoc: JsdocSummary;
}

export interface VisitorContext {
  /** We're processing a static variable declaration */
  isStatic?: boolean;
  /** While processing a function expression or struct literal, the signifier may come from an assignment operation. */
  signifier?: Signifier;
  /** While processing `method()` calls, we may find the self-context
   * of the function in the second argument.
   */
  self?: Type;
  docs?: Docs;
  // /** The context stack as referenceable entities */
  // ctxStack: Referenceable[];
  /** Helpful to get general info about the context of the current node. */
  ctxKindStack: NodeContextKind[];
  /** If we're in a function, the return statement values we've found */
  returns?: (Type | TypeStore)[];
}

export function withCtxKind<T extends NodeContextKind>(
  ctx: VisitorContext,
  kind: T,
): VisitorContext {
  return {
    ctxKindStack: [...ctx.ctxKindStack, kind],
    returns: ctx.returns,
  };
}

export const parser = new GmlParser();
export const GmlVisitorBase =
  parser.getBaseCstVisitorConstructorWithDefaults() as new (
    ...args: any[]
  ) => GmlVisitor<
    VisitorContext,
    | undefined
    | void
    | Type
    | (Type | TypeStore)[]
    | TypeStore
    | { item: ReferenceableType; ref: Reference }
  >;
