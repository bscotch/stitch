import { CstNode, CstParser, ParserMethod } from 'chevrotain';
import { t, tokens } from './tokens.js';

export class GmlParser extends CstParser {
  constructor() {
    super(tokens);

    const $ = this as this & Record<string, ParserMethod<[], CstNode>>;

    $.RULE('program', () => {
      $.MANY(() => {
        $.SUBRULE($.statement);
      });
    });

    $.RULE('statement', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.ifStatement) },
        { ALT: () => $.SUBRULE($.whileStatement) },
        { ALT: () => $.SUBRULE($.doStatement) },
        { ALT: () => $.SUBRULE($.expression) },
        { ALT: () => $.SUBRULE($.emptyStatement) },
        { ALT: () => $.SUBRULE($.blockStatement) },
      ]);
    });

    $.RULE('functionExpression', () => {
      $.CONSUME(t.Function);
      $.OPTION(() => {
        $.CONSUME(t.Identifier);
      });
      $.CONSUME(t.StartParen);
      $.MANY_SEP({
        SEP: t.Comma,
        DEF: () => {
          $.CONSUME(t.Identifier);
          $.OPTION(() => {
            $.CONSUME($.statement);
          });
        },
      });
      $.CONSUME(t.EndParen);
      $.OPTION(() => {
        $.CONSUME(t.Constructor);
      });
      $.SUBRULE($.blockStatement);
    });

    $.RULE('ifStatement', () => {
      $.OPTION(() => {
        $.CONSUME(t.Else);
      });
      $.CONSUME(t.If);
      $.OR([
        { ALT: () => $.SUBRULE($.parenExpression) },
        { ALT: () => $.SUBRULE($.expression) },
      ]);
      $.SUBRULE($.statement);
      $.OPTION(() => {
        $.CONSUME(t.Else);
        $.SUBRULE2($.statement);
      });
    });

    $.RULE('whileStatement', () => {
      $.CONSUME(t.While);
      $.SUBRULE($.parenExpression);
      $.SUBRULE($.statement);
    });

    $.RULE('doStatement', () => {
      $.CONSUME(t.Do);
      $.SUBRULE($.statement);
      $.CONSUME(t.Until);
      $.SUBRULE($.parenExpression);
      $.CONSUME(t.Semicolon);
    });

    $.RULE('blockStatement', () => {
      $.OR([
        { ALT: () => $.CONSUME(t.StartBrace) },
        { ALT: () => $.CONSUME(t.Begin) },
      ]);
      $.CONSUME(t.StartBrace);
      $.MANY(() => {
        $.SUBRULE($.statement);
      });
      $.OR([
        { ALT: () => $.CONSUME(t.EndBrace) },
        { ALT: () => $.CONSUME(t.End) },
      ]);
    });

    $.RULE('expression', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.assignExpression) },
        { ALT: () => $.SUBRULE($.relationExpression) },
        { ALT: () => $.SUBRULE($.functionExpression) },
      ]);
      $.OPTION(() => {
        $.CONSUME(t.Semicolon);
      });
    });

    $.RULE('relationExpression', () => {
      $.SUBRULE($.AdditionExpression);
      $.MANY(() => {
        $.CONSUME(t.LessThan);
        $.SUBRULE2($.AdditionExpression);
      });
    });

    $.RULE('AdditionExpression', () => {
      $.SUBRULE($.term);
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(t.Plus) },
          { ALT: () => $.CONSUME(t.Minus) },
        ]);
        $.SUBRULE2($.term);
      });
    });

    $.RULE('assignExpression', () => {
      $.CONSUME(t.Identifier);
      $.CONSUME(t.Equals);
      $.SUBRULE($.expression);
    });

    $.RULE('term', () => {
      $.OR([
        { ALT: () => $.CONSUME(t.Identifier) },
        { ALT: () => $.CONSUME(t.Real) },
        { ALT: () => $.SUBRULE($.parenExpression) },
      ]);
    });

    $.RULE('parenExpression', () => {
      $.CONSUME(t.StartParen);
      $.SUBRULE($.expression);
      $.CONSUME(t.EndParen);
    });

    $.RULE('emptyStatement', () => {
      $.CONSUME(t.Semicolon);
    });

    this.performSelfAnalysis();
  }
}
