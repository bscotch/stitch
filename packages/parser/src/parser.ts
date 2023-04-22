import { CstNode, CstParser } from 'chevrotain';
import { GmlLexer } from './lexer.js';
import { c, categories, t, tokens } from './tokens.js';

export class GmlParser extends CstParser {
  readonly lexer = GmlLexer;

  readonly program = this.RULE('program', () => {
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
      { ALT: () => this.SUBRULE(this.expressionStatement) },
      { ALT: () => this.SUBRULE(this.functionStatement) },
      { ALT: () => this.SUBRULE(this.localVarDeclarationsStatement) },
      { ALT: () => this.SUBRULE(this.globalVarDeclarationsStatement) },
      { ALT: () => this.SUBRULE(this.staticVarDeclarationStatement) },
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
    ]);
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
        { ALT: () => this.SUBRULE(this.variableAssignment) },
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
      { ALT: () => this.CONSUME(c.Literal) },
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
    this.SUBRULE(this.identifier);
    this.MANY(() => {
      this.SUBRULE(this.expressionSuffixes);
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

  readonly expressionSuffixes = this.RULE('expressionSuffixes', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.arrayAccessSuffix) },
      { ALT: () => this.SUBRULE(this.structAccessorSuffix) },
      { ALT: () => this.SUBRULE(this.listAccessorSuffix) },
      { ALT: () => this.SUBRULE(this.mapAccessorSuffix) },
      { ALT: () => this.SUBRULE(this.gridAccessorSuffix) },
      { ALT: () => this.SUBRULE(this.arrayMutationAccessorSuffix) },
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
      this.SUBRULE(this.assignmentRightHandSide);
    });
    this.MANY(() => {
      this.CONSUME(t.Comma);
      this.OPTION2(() => this.SUBRULE2(this.assignmentRightHandSide));
    });
    this.CONSUME(t.EndParen);
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

  readonly variableAssignment = this.RULE('variableAssignment', () => {
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
      { ALT: () => this.CONSUME(t.Identifier) },
      { ALT: () => this.SUBRULE(this.stringLiteral) },
    ]);
    this.CONSUME(t.Colon);
    this.SUBRULE(this.assignmentRightHandSide);
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
    });

    this.performSelfAnalysis();
  }

  parse(code: string): CstNode | undefined {
    this.input = this.lexer.tokenize(code).tokens;
    return this.program();
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
