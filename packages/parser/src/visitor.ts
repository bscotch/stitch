// CST Visitor for creating an AST etc
import { ok } from 'assert';
import type {
  GmlVisitor,
  ProgramCstChildren,
  StatementCstChildren,
} from '../gml-cst.js';
import { GmlParser } from './parser.js';

const GmlVisitorBase =
  new GmlParser().getBaseCstVisitorConstructorWithDefaults() as new (
    ...args: any[]
  ) => GmlVisitor<unknown, unknown>;

export class GmlCstVisitor extends GmlVisitorBase {
  constructor() {
    super();
    this.validateVisitor();
  }

  override program(children: ProgramCstChildren) {
    return {
      kind: 'program',
      statements: children.statements.map((s) => this.visit(s)),
    };
  }

  override statement(children: StatementCstChildren, param?: unknown) {
    const keys = Object.keys(children) as (keyof StatementCstChildren)[];
    ok(keys.length === 1, Error('Statement should have exactly one child'));
    const key = keys[0];
    console.log(key);
    return this.visit(children[keys[0]] as any);
  }
}
