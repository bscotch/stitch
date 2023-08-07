import { CstNode, IToken } from 'chevrotain';
import type {
  EnumMemberCstChildren,
  EnumStatementCstChildren,
  FileCstChildren,
  GmlVisitor,
  StatementCstChildren,
  StatementsCstChildren,
} from '../gml-cst.js';
import {
  EnumMember,
  EnumStatement,
  File,
  Identifier,
  Node,
  RealLiteral,
  Statement,
} from './ast.types.js';
import { parser } from './parser.js';
import { CstLocation, IRange } from './project.location.js';
import { isArray } from './util.js';

interface Context {
  /** For contexts where the index position matters */
  idx?: number;
  loc: IRange;
}

const GmlCstVisitorBase =
  parser.getBaseCstVisitorConstructorWithDefaults() as new (
    ...args: any[]
  ) => GmlVisitor<Context, Node[] | Node | undefined>;

export class GmlCstGenerator extends GmlCstVisitorBase {
  constructor(readonly info?: { type: 'script' | 'object' }) {
    super();
    this.validateVisitor();
  }

  protected normalizeIdentifier(
    token: IToken[] | undefined,
    parentContext?: Context,
  ): Identifier {
    const identifier = token?.[0];
    return {
      type: 'Identifier',
      name: identifier?.image || '',
      loc: this.locFromToken(identifier) || parentContext?.loc,
    };
  }

  protected locFromToken(token: IToken | undefined): IRange | undefined {
    if (!token?.startOffset) {
      return;
    }
    return {
      start: {
        offset: token.startOffset,
        line: token.startLine!,
        column: token.startColumn!,
      },
      end: {
        offset: token.endOffset!,
        line: token.endLine!,
        column: token.endColumn!,
      },
    };
  }

  protected locFromNode(cstNode: CstNode): IRange {
    const location = cstNode.location as CstLocation;
    return {
      start: {
        offset: location.startOffset,
        line: location.startLine,
        column: location.startColumn,
      },
      end: {
        offset: location.endOffset,
        line: location.endLine,
        column: location.endColumn,
      },
    };
  }

  override visit<Nodes extends CstNode[] | CstNode>(
    cstNode: Nodes,
    ctx?: Context,
  ): Nodes extends [] ? Node[] : Node | undefined {
    if (isArray(cstNode)) {
      return cstNode
        .map((node) => {
          const loc = this.locFromNode(node);
          return super.visit(node, { ...ctx, loc });
        })
        .filter((x) => !!x) as Nodes extends [] ? Node[] : Node | undefined;
    } else {
      return super.visit(cstNode, {
        ...ctx,
        loc: this.locFromNode(cstNode),
      }) as Nodes extends [] ? Node[] : Node | undefined;
    }
  }

  /** The root for a GML file */
  override file(children: FileCstChildren, ctx: Context): File {
    const node: File = {
      type: 'File',
      loc: ctx.loc,
      body: this.statements(children.statements[0]?.children, ctx),
    };
    return node;
  }

  override statements(
    children: StatementsCstChildren,
    ctx: Context,
  ): Statement[] {
    return (
      children.statement?.map((statement) => {
        const loc = this.locFromNode(statement);
        return this.statement(statement.children, { ...ctx, loc });
      }) ?? []
    );
  }

  override statement(
    children: StatementCstChildren,
    param?: Context | undefined,
  ): Statement {
    // The statement can only match one statement type, so it should
    // have at most one child.
    if (children.enumStatement) {
      const loc = this.locFromNode(children.enumStatement[0]);
      return this.enumStatement(children.enumStatement[0].children, {
        ...param,
        loc,
      });
    }
    return {} as Statement;
  }

  override enumStatement(
    children: EnumStatementCstChildren,
    param?: Context | undefined,
  ): EnumStatement {
    return {
      type: 'EnumStatement',
      id: this.normalizeIdentifier(children.Identifier, param),
      loc: param?.loc,
      body: children.enumMember?.map((member, idx) => {
        const loc = this.locFromNode(member);
        return this.enumMember(member.children, { ...param, idx, loc });
      }),
    };
  }

  override enumMember(
    children: EnumMemberCstChildren,
    param?: Context | undefined,
  ): EnumMember {
    let enumValue = children.Assign
      ? children.NumericLiteral?.[0].image
      : param?.idx;
    if (children.Minus && typeof enumValue === 'string') {
      enumValue = `-${enumValue}`;
    }
    let value: undefined | RealLiteral;
    if (
      (typeof enumValue === 'string' && enumValue) ||
      typeof enumValue === 'number'
    ) {
      value = {
        type: 'Literal',
        kind: 'Real',
        value: +enumValue,
      };
    }

    return {
      type: 'EnumMember',
      id: this.normalizeIdentifier(children.Identifier, param),
      value,
      loc: param?.loc,
    };
  }
}
