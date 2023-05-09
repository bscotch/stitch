// CST Visitor for creating an AST etc
import { ok } from 'assert';
import type {
  FileCstChildren,
  GmlVisitor,
  StatementCstChildren,
} from '../gml-cst.js';
import { GmlParser } from './parser.js';
import { Gml } from './spec.js';

const GmlVisitorBase =
  new GmlParser().getBaseCstVisitorConstructorWithDefaults() as new (
    ...args: any[]
  ) => GmlVisitor<unknown, unknown>;

export class GmlSymbolVisitor extends GmlVisitorBase {
  constructor(readonly spec: Gml) {
    super();
    this.validateVisitor();
  }

  override file(children: FileCstChildren, info: unknown) {
    console.log(info);
    console.log(children);
    return;
  }

  override statement(children: StatementCstChildren, param?: unknown) {
    const keys = Object.keys(children) as (keyof StatementCstChildren)[];
    ok(keys.length === 1, Error('Statement should have exactly one child'));
    const key = keys[0];
    console.log(key);
    return this.visit(children[keys[0]] as any);
  }
}
