import { CstNode, CstParser, ParserMethod } from 'chevrotain';
import { GmlLexer } from './lexer.js';
import { c, categories, t, tokens } from './tokens.js';

export class GmlParser extends CstParser {
  readonly lexer = GmlLexer;

  constructor() {
    super([...tokens, ...categories]);

    const $ = this as this & Record<string, ParserMethod<any, CstNode>>;

    this.RULE('program', () => {
      $.MANY(() => $.SUBRULE($.statement));
    });

    this.RULE('statement', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.ifStatement) },
        { ALT: () => $.SUBRULE($.functionStatement) },
        { ALT: () => $.SUBRULE($.whileStatement) },
        { ALT: () => $.SUBRULE($.forStatement) },
        { ALT: () => $.SUBRULE($.doWhileStatement) },
        { ALT: () => $.SUBRULE($.switchStatement) },
        { ALT: () => $.SUBRULE($.breakStatement) },
        { ALT: () => $.SUBRULE($.continueStatement) },
        { ALT: () => $.SUBRULE($.returnStatement) },
        { ALT: () => $.SUBRULE($.exitStatement) },
        { ALT: () => $.SUBRULE($.withStatement) },
        { ALT: () => $.SUBRULE($.enumStatement) },
        { ALT: () => $.SUBRULE($.blockStatement) },
        { ALT: () => $.SUBRULE($.expressionStatement) },
        { ALT: () => $.SUBRULE($.macroStatement) },
        { ALT: () => $.SUBRULE($.declarationStatement) },
      ]);
    });

    $.RULE('enumStatement', () => {
      $.CONSUME(t.Enum);
      $.CONSUME1(t.Identifier);
      $.CONSUME(t.StartBrace);
      $.MANY_SEP({
        SEP: t.Comma,
        DEF: () => {
          $.CONSUME2(t.Identifier);
          $.OPTION(() => {
            $.CONSUME(t.Assign);
            $.CONSUME(c.NumericLiteral);
          });
        },
      });
      $.CONSUME(t.EndBrace);
    });

    $.RULE('functionStatement', () => {
      $.CONSUME(t.Function);
      $.OPTION1(() => $.CONSUME1(t.Identifier));
      $.SUBRULE1($.functionParameters);
      $.OPTION2(() => {
        $.OPTION(() => {
          $.CONSUME(t.Colon);
          $.CONSUME2(t.Identifier);
          $.SUBRULE2($.functionParameters);
        });
        $.CONSUME(t.Constructor);
      });
      $.SUBRULE($.blockStatement);
    });

    $.RULE('functionParameters', () => {
      $.CONSUME(t.StartParen);
      $.MANY_SEP({
        SEP: t.Comma,
        DEF: () => $.SUBRULE($.functionParameter),
      });
      $.CONSUME(t.EndParen);
    });

    $.RULE('functionParameter', () => {
      $.CONSUME(t.Identifier);
      $.OPTION(() => {
        $.CONSUME(t.Assign);
        $.SUBRULE($.expression);
      });
    });

    $.RULE('macroStatement', () => {
      $.CONSUME(t.Macro);
      $.CONSUME(t.Identifier);
      $.MANY_SEP({
        SEP: t.Escape,
        DEF: () => $.SUBRULE($.expression),
      });
    });

    $.RULE('expressionStatement', () => {
      $.SUBRULE($.expression);
      $.OPTION(() => $.CONSUME(t.Semicolon));
    });

    $.RULE('ifStatement', () => {
      $.CONSUME(t.If);
      $.SUBRULE($.expression);
      $.SUBRULE($.statement);
      $.MANY(() => $.SUBRULE2($.elseIfStatement));
      $.OPTION(() => {
        $.CONSUME(t.Else);
        $.SUBRULE2($.statement);
      });
    });

    $.RULE('elseIfStatement', () => {
      $.CONSUME(t.Else);
      $.CONSUME(t.If);
      $.SUBRULE($.expression);
      $.SUBRULE($.statement);
    });

    $.RULE('whileStatement', () => {
      $.CONSUME(t.While);
      $.SUBRULE($.expression);
      $.SUBRULE($.statement);
    });

    $.RULE('forStatement', () => {
      $.CONSUME(t.For);
      $.CONSUME(t.StartParen);
      $.OPTION1(() => $.SUBRULE1($.expression));
      $.CONSUME2(t.Semicolon);
      $.OPTION2(() => $.SUBRULE2($.expression));
      $.CONSUME3(t.Semicolon);
      $.OPTION3(() => $.SUBRULE3($.expression));
      $.CONSUME(t.EndParen);
      $.SUBRULE($.statement);
    });

    $.RULE('doWhileStatement', () => {
      $.CONSUME(t.Do);
      $.SUBRULE($.statement);
      $.CONSUME(t.While);
      $.SUBRULE($.expression);
      $.OPTION(() => $.CONSUME(t.Semicolon));
    });

    $.RULE('switchStatement', () => {
      $.CONSUME(t.Switch);
      $.SUBRULE($.expression);
      $.CONSUME(t.StartBrace);
      $.MANY(() => $.SUBRULE($.caseStatement));
      $.OPTION(() => $.SUBRULE($.defaultStatement));
      $.CONSUME(t.EndBrace);
    });

    $.RULE('caseStatement', () => {
      $.CONSUME(t.Case);
      $.SUBRULE($.expression);
      $.CONSUME(t.Colon);
      $.SUBRULE($.statement);
    });

    $.RULE('defaultStatement', () => {
      $.CONSUME(t.Default);
      $.CONSUME(t.Colon);
      $.SUBRULE($.statement);
    });

    $.RULE('breakStatement', () => {
      $.CONSUME(t.Break);
      $.OPTION(() => $.CONSUME(t.Semicolon));
    });

    $.RULE('continueStatement', () => {
      $.CONSUME(t.Continue);
      $.OPTION(() => $.CONSUME(t.Semicolon));
    });

    $.RULE('returnStatement', () => {
      $.CONSUME(t.Return);
      $.OPTION1(() => $.SUBRULE($.expression));
      $.OPTION2(() => $.CONSUME(t.Semicolon));
    });

    $.RULE('exitStatement', () => {
      $.CONSUME(t.Exit);
      $.OPTION(() => $.CONSUME(t.Semicolon));
    });

    $.RULE('withStatement', () => {
      $.CONSUME(t.With);
      $.SUBRULE($.expression);
      $.SUBRULE($.statement);
    });

    $.RULE('blockStatement', () => {
      $.CONSUME(t.StartBrace);
      $.MANY(() => $.SUBRULE($.statement));
      $.CONSUME(t.EndBrace);
    });

    $.RULE('declaration', () => {
      $.OR([
        { ALT: () => $.CONSUME(t.Var) },
        { ALT: () => $.CONSUME(t.GlobalVar) },
      ]);
      $.CONSUME(t.Identifier);
      $.OPTION1(() => {
        $.CONSUME(c.AssignmentOperator);
        $.SUBRULE($.expression);
      });
    });

    $.RULE('declarationStatement', () => {
      $.SUBRULE($.declaration);
      $.OPTION2(() => $.CONSUME(t.Semicolon));
    });

    $.RULE('primaryExpression', () => {
      $.OR([
        { ALT: () => $.CONSUME(t.Identifier) },
        { ALT: () => $.CONSUME(c.Literal) },
        {
          ALT: () => {
            $.CONSUME1(t.StartParen);
            $.SUBRULE($.expression);
            $.CONSUME2(t.EndParen);
          },
        },
      ]);
    });

    $.RULE('expression', () => {
      $.SUBRULE($.binaryExpression);
      $.SUBRULE($.functionCallExpression);
      // Add more complex expression types here as needed
    });

    $.RULE('functionCallExpression', () => {
      $.OPTION(() => $.CONSUME(t.New));
      $.SUBRULE($.primaryExpression);
      $.CONSUME(t.StartParen);
      $.MANY_SEP({
        SEP: t.Comma,
        DEF: () => $.SUBRULE($.expression),
      });
      $.CONSUME(t.EndParen);
    });

    $.RULE('binaryExpression', () => {
      $.SUBRULE($.primaryExpression);
      $.CONSUME(c.BinaryOperator);
      $.SUBRULE2($.primaryExpression);
    });

    this.performSelfAnalysis();
  }

  parse(code: string) {
    this.input = this.lexer.tokenize(code).tokens;
    // @ts-expect-error
    return this['program']();
  }
}
