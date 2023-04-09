import { CstNode, CstParser, ParserMethod } from 'chevrotain';
import { GmlLexer } from './lexer.js';
import { c, categories, t, tokens } from './tokens.js';

export class GmlParser extends CstParser {
  readonly lexer = GmlLexer;

  constructor() {
    super([...tokens, ...categories], {
      nodeLocationTracking: 'full',
    });

    const $ = this as this & Record<string, ParserMethod<any, CstNode>>;

    $.RULE('program', () => {
      $.MANY(() => $.SUBRULE($.statement));
    });

    $.RULE('statement', () => {
      // Start by trying to parse increasingly complex expression statements
      $.OR([{ ALT: () => $.SUBRULE($.expressionStatement) }]);
    });

    $.RULE('expressionStatement', () => {
      $.SUBRULE($.expression);
      $.OPTION(() => $.CONSUME(t.Semicolon));
    });

    $.RULE('expression', () => {
      $.SUBRULE($.primaryExpression);
      $.MANY(() => {
        $.CONSUME(c.BinaryOperator);
        $.SUBRULE2($.primaryExpression);
      });
    });

    $.RULE('primaryExpression', () => {
      $.OPTION1(() => $.CONSUME(c.UnaryPrefixOperator));
      $.OR1([
        { ALT: () => $.CONSUME(c.Literal) },
        {
          ALT: () => {
            $.CONSUME(t.Identifier);
            $.MANY(() => {
              $.OR2([
                { ALT: () => $.SUBRULE($.arrayAccessSuffix) },
                { ALT: () => $.SUBRULE($.functionCallSuffix) },
              ]);
            });
          },
        },
        { ALT: () => $.SUBRULE($.parenthesizedExpression) },
      ]);
      $.OPTION2(() => $.CONSUME(c.UnarySuffixOperator));
    });

    $.RULE('parenthesizedExpression', () => {
      $.CONSUME(t.StartParen);
      $.SUBRULE($.expression);
      $.CONSUME(t.EndParen);
    });

    $.RULE('arrayAccessSuffix', () => {
      $.CONSUME(t.StartBracket);
      $.SUBRULE($.expression);
      $.CONSUME(t.EndBracket);
    });

    $.RULE('functionCallSuffix', () => {
      $.CONSUME(t.StartParen);
      $.MANY_SEP({
        SEP: t.Comma,
        DEF: () => {
          $.OR([
            { ALT: () => $.SUBRULE($.expression) },
            { ALT: () => $.SUBRULE($.emptyArgument) },
          ]);
        },
      });
      $.CONSUME(t.EndParen);
    });

    $.RULE('emptyArgument', () => {
      $.CONSUME(t.Comma);
    });

    // this.RULE('statement', () => {
    //   $.OR([
    //     { ALT: () => $.SUBRULE($.ifStatement) },
    //     { ALT: () => $.SUBRULE($.functionStatement) },
    //     { ALT: () => $.SUBRULE($.tryStatement) },
    //     { ALT: () => $.SUBRULE($.whileStatement) },
    //     { ALT: () => $.SUBRULE($.forStatement) },
    //     { ALT: () => $.SUBRULE($.doWhileStatement) },
    //     { ALT: () => $.SUBRULE($.switchStatement) },
    //     { ALT: () => $.SUBRULE($.breakStatement) },
    //     { ALT: () => $.SUBRULE($.continueStatement) },
    //     { ALT: () => $.SUBRULE($.returnStatement) },
    //     { ALT: () => $.SUBRULE($.exitStatement) },
    //     { ALT: () => $.SUBRULE($.withStatement) },
    //     { ALT: () => $.SUBRULE($.enumStatement) },
    //     { ALT: () => $.SUBRULE($.blockStatement) },
    //     { ALT: () => $.SUBRULE($.expressionStatement) },
    //     { ALT: () => $.SUBRULE($.macroStatement) },
    //     { ALT: () => $.SUBRULE($.declarationStatement) },
    //     { ALT: () => $.SUBRULE($.emptyStatement) },
    //   ]);
    // });

    // $.RULE('emptyStatement', () => {
    //   $.CONSUME(t.Semicolon);
    // });

    // $.RULE('enumStatement', () => {
    //   $.CONSUME(t.Enum);
    //   $.CONSUME1(t.Identifier);
    //   $.CONSUME(t.StartBrace);
    //   $.MANY_SEP({
    //     SEP: t.Comma,
    //     DEF: () => {
    //       $.CONSUME2(t.Identifier);
    //       $.OPTION(() => {
    //         $.CONSUME(t.Assign);
    //         $.CONSUME(c.NumericLiteral);
    //       });
    //     },
    //   });
    //   $.CONSUME(t.EndBrace);
    // });

    // $.RULE('functionExpression', () => {
    //   $.CONSUME(t.Function);
    //   $.OPTION1(() => $.CONSUME1(t.Identifier));
    //   $.SUBRULE1($.functionParameters);
    //   $.OPTION2(() => {
    //     $.OPTION(() => {
    //       $.CONSUME(t.Colon);
    //       $.CONSUME2(t.Identifier);
    //       $.SUBRULE2($.functionArguments);
    //     });
    //     $.CONSUME(t.Constructor);
    //   });
    //   $.SUBRULE($.blockStatement);
    // });

    // $.RULE('functionStatement', () => {
    //   $.SUBRULE($.functionExpression);
    //   $.OPTION(() => $.CONSUME(t.Semicolon));
    // });

    // $.RULE('functionArguments', () => {
    //   $.CONSUME(t.StartParen);
    //   $.MANY_SEP({
    //     SEP: t.Comma,
    //     DEF: () => $.SUBRULE($.expression),
    //   });
    //   $.CONSUME(t.EndParen);
    // });

    // $.RULE('functionParameters', () => {
    //   $.CONSUME(t.StartParen);
    //   $.MANY_SEP({
    //     SEP: t.Comma,
    //     DEF: () => $.SUBRULE($.functionParameter),
    //   });
    //   $.CONSUME(t.EndParen);
    // });

    // $.RULE('functionParameter', () => {
    //   $.CONSUME(t.Identifier);
    //   $.OPTION(() => {
    //     $.CONSUME(t.Assign);
    //     $.SUBRULE($.expression);
    //   });
    // });

    // $.RULE('macroStatement', () => {
    //   $.CONSUME(t.Macro);
    //   $.CONSUME(t.Identifier);
    //   $.MANY_SEP({
    //     SEP: t.Escape,
    //     DEF: () => $.SUBRULE($.expression),
    //   });
    // });

    // $.RULE('expressionStatement', () => {
    //   $.SUBRULE($.expression);
    //   $.OPTION(() => $.CONSUME(t.Semicolon));
    // });

    // $.RULE('ifStatement', () => {
    //   $.CONSUME(t.If);
    //   $.SUBRULE($.expression);
    //   $.SUBRULE($.statement);
    //   $.MANY(() => $.SUBRULE2($.elseIfStatement));
    //   $.OPTION(() => {
    //     $.CONSUME(t.Else);
    //     $.SUBRULE2($.statement);
    //   });
    // });

    // $.RULE('elseIfStatement', () => {
    //   $.CONSUME(t.Else);
    //   $.CONSUME(t.If);
    //   $.SUBRULE($.expression);
    //   $.SUBRULE($.statement);
    // });

    // $.RULE('whileStatement', () => {
    //   $.CONSUME(t.While);
    //   $.SUBRULE($.expression);
    //   $.SUBRULE($.statement);
    // });

    // $.RULE('forStatement', () => {
    //   $.CONSUME(t.For);
    //   $.CONSUME(t.StartParen);
    //   $.OPTION1(() => $.SUBRULE1($.expression));
    //   $.CONSUME2(t.Semicolon);
    //   $.OPTION2(() => $.SUBRULE2($.expression));
    //   $.CONSUME3(t.Semicolon);
    //   $.OPTION3(() => $.SUBRULE3($.expression));
    //   $.CONSUME(t.EndParen);
    //   $.SUBRULE($.statement);
    // });

    // $.RULE('doWhileStatement', () => {
    //   $.CONSUME(t.Do);
    //   $.SUBRULE($.statement);
    //   $.CONSUME(t.While);
    //   $.SUBRULE($.expression);
    //   $.OPTION(() => $.CONSUME(t.Semicolon));
    // });

    // $.RULE('switchStatement', () => {
    //   $.CONSUME(t.Switch);
    //   $.SUBRULE($.expression);
    //   $.CONSUME(t.StartBrace);
    //   $.MANY(() => $.SUBRULE($.caseStatement));
    //   $.OPTION(() => $.SUBRULE($.defaultStatement));
    //   $.CONSUME(t.EndBrace);
    // });

    // $.RULE('caseStatement', () => {
    //   $.CONSUME(t.Case);
    //   $.SUBRULE($.expression);
    //   $.CONSUME(t.Colon);
    //   $.SUBRULE($.statement);
    // });

    // $.RULE('defaultStatement', () => {
    //   $.CONSUME(t.Default);
    //   $.CONSUME(t.Colon);
    //   $.SUBRULE($.statement);
    // });

    // $.RULE('breakStatement', () => {
    //   $.CONSUME(t.Break);
    //   $.OPTION(() => $.CONSUME(t.Semicolon));
    // });

    // $.RULE('continueStatement', () => {
    //   $.CONSUME(t.Continue);
    //   $.OPTION(() => $.CONSUME(t.Semicolon));
    // });

    // $.RULE('returnStatement', () => {
    //   $.CONSUME(t.Return);
    //   $.OPTION1(() => $.SUBRULE($.expression));
    //   $.OPTION2(() => $.CONSUME(t.Semicolon));
    // });

    // $.RULE('exitStatement', () => {
    //   $.CONSUME(t.Exit);
    //   $.OPTION(() => $.CONSUME(t.Semicolon));
    // });

    // $.RULE('withStatement', () => {
    //   $.CONSUME(t.With);
    //   $.SUBRULE($.expression);
    //   $.SUBRULE($.statement);
    // });

    // $.RULE('blockStatement', () => {
    //   $.CONSUME(t.StartBrace);
    //   $.MANY(() => $.SUBRULE($.statement));
    //   $.CONSUME(t.EndBrace);
    // });

    // $.RULE('declaration', () => {
    //   $.OR([
    //     { ALT: () => $.CONSUME(t.Var) },
    //     { ALT: () => $.CONSUME(t.Static) },
    //     { ALT: () => $.CONSUME(t.GlobalVar) },
    //   ]);
    //   $.CONSUME(t.Identifier);
    //   $.OPTION1(() => {
    //     $.CONSUME(c.AssignmentOperator);
    //     $.SUBRULE($.expression);
    //   });
    // });

    // $.RULE('declarationStatement', () => {
    //   $.SUBRULE($.declaration);
    //   $.OPTION2(() => $.CONSUME(t.Semicolon));
    // });

    // $.RULE('primaryExpression', () => {
    //   $.OR([
    //     { ALT: () => $.CONSUME(t.Identifier) },
    //     { ALT: () => $.CONSUME(c.Literal) },
    //     { ALT: () => $.SUBRULE($.arrayLiteral) },
    //     { ALT: () => $.SUBRULE($.structLiteral) },
    //     { ALT: () => $.SUBRULE($.parenthesisExpression) },
    //   ]);
    // });

    // $.RULE('parenthesisExpression', () => {
    //   $.CONSUME(t.StartParen);
    //   $.SUBRULE($.primaryExpression);
    //   $.CONSUME(t.EndParen);
    // });

    // $.RULE('arrayLiteral', () => {
    //   $.CONSUME(t.StartBracket);
    //   $.MANY_SEP({
    //     SEP: t.Comma,
    //     DEF: () => $.SUBRULE($.expression),
    //   });
    //   $.CONSUME(t.EndBracket);
    // });

    // $.RULE('structLiteral', () => {
    //   $.CONSUME(t.StartBrace);
    //   $.MANY_SEP({
    //     SEP: t.Comma,
    //     DEF: () => $.SUBRULE($.structLiteralEntry),
    //   });
    //   $.CONSUME(t.EndBrace);
    // });

    // $.RULE('structLiteralEntry', () => {
    //   $.CONSUME(t.Identifier);
    //   $.CONSUME(t.Colon);
    //   $.SUBRULE($.expression);
    // });

    // $.RULE('expression', () => {
    //   $.OR([
    //     { ALT: () => $.SUBRULE($.binaryExpression) },
    //     { ALT: () => $.SUBRULE($.unaryPrefixExpression) },
    //     { ALT: () => $.SUBRULE($.unarySuffixExpression) },
    //     { ALT: () => $.SUBRULE($.functionCallExpression) },
    //   ]);
    //   // Add more complex expression types here as needed
    // });

    // $.RULE('functionCallExpression', () => {
    //   $.MANY(() => {
    //     $.CONSUME(t.New);
    //   });
    //   $.SUBRULE($.primaryExpression);
    //   $.MANY2(() => {
    //     $.OR2([
    //       { ALT: () => $.SUBRULE($.boxMemberExpression) },
    //       { ALT: () => $.SUBRULE($.dotMemberExpression) },
    //       { ALT: () => $.SUBRULE($.functionArguments) },
    //     ]);
    //   });
    // });

    // $.RULE('boxMemberExpression', () => {
    //   $.CONSUME(t.StartBracket);
    //   $.SUBRULE($.expression);
    //   $.CONSUME(t.EndBracket);
    // });

    // $.RULE('dotMemberExpression', () => {
    //   $.CONSUME(t.Dot);
    //   $.CONSUME(t.Identifier);
    // });

    // $.RULE('binaryExpression', () => {
    //   $.SUBRULE($.primaryExpression);
    //   $.CONSUME(c.BinaryOperator);
    //   $.SUBRULE2($.primaryExpression);
    // });

    // $.RULE('unaryPrefixExpression', () => {
    //   $.SUBRULE($.primaryExpression);
    //   $.CONSUME(c.UnaryPrefixOperator);
    // });

    // $.RULE('unarySuffixExpression', () => {
    //   $.SUBRULE($.primaryExpression);
    //   $.CONSUME(c.UnarySuffixOperator);
    // });

    // $.RULE('tryStatement', () => {
    //   $.CONSUME(t.Try);
    //   $.SUBRULE($.blockStatement);
    //   $.OPTION1(() => {
    //     $.CONSUME(t.Catch);
    //     $.CONSUME(t.StartParen);
    //     $.CONSUME(t.Identifier);
    //     $.CONSUME(t.EndParen);
    //     $.SUBRULE2($.blockStatement);
    //   });
    //   $.OPTION2(() => {
    //     $.CONSUME(t.Finally);
    //     $.SUBRULE3($.blockStatement);
    //   });
    // });

    this.performSelfAnalysis();
  }

  parse(code: string): CstNode | undefined {
    this.input = this.lexer.tokenize(code).tokens;
    // @ts-expect-error
    return this['program']();
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
