import { undent } from '@bscotch/utility';
import { ok } from 'assert';
import { expect } from 'chai';
import fs from 'fs/promises';
import { Parser } from './parser.js';
import {
  ConstructorDeclaration,
  FunctionDeclaration,
  SyntaxKind,
} from './parser.types.js';

describe('GML Parser', function () {
  it('can identify top-level functions and macros', function () {
    const sample = undent`
      // This is a comment
      function foo() {
        function ignoredInnerFunction(){}
        return "hello";
      }
      #macro hello "world"
      function bar() {}
      function hasParams(a, b, c) {}
      #macro goodbye hello + "!"
      function hasDefaultParams(a = 1, b = 2, c = 3) {
        #macro internalMacro "hello"
        globalvar INTERNAL_GLOBAL;
      }
      globalvar GLOBAL_VAR;
      function isStruct(_) constructor {}
      function hasComplexDefaultParams(a = 1 + 2, b = 2 * 3, c = 3 / 4) {}
    `;
    const parser = new Parser(sample);
    parser.parse();

    const paramNames = (func: FunctionDeclaration | ConstructorDeclaration) =>
      func.info.map((p) => p.name);

    ok(parser.functions.get('foo'));
    ok(parser.functions.get('bar'));

    const hasParams = parser.functions.get('hasParams');
    ok(hasParams);
    expect(paramNames(hasParams)).to.eql(['a', 'b', 'c']);

    const hasDefaultParams = parser.functions.get('hasDefaultParams');
    ok(hasDefaultParams);
    expect(paramNames(hasDefaultParams)).to.eql(['a', 'b', 'c']);

    const isStruct = parser.functions.get('isStruct');
    ok(isStruct);
    expect(paramNames(isStruct)).to.eql(['_']);
    expect(isStruct.kind).to.equal(SyntaxKind.ConstructorDeclaration);

    const hasComplexDefaultParams = parser.functions.get(
      'hasComplexDefaultParams',
    );
    ok(hasComplexDefaultParams);
    expect(paramNames(hasComplexDefaultParams)).to.eql(['a', 'b', 'c']);

    ok(parser.macros.get('hello'));
    ok(parser.macros.get('goodbye'));
    ok(parser.macros.get('internalMacro'));
    ok(parser.globalvars.get('GLOBAL_VAR'));
    ok(parser.globalvars.get('INTERNAL_GLOBAL'));
  });

  it('can parse samples without choking', async function () {
    const samples = await fs.readdir('./samples');
    for (const sample of samples) {
      const filePath = `./samples/${sample}`;
      const code = await fs.readFile(filePath, 'utf-8');
      const parser = new Parser(code, { filePath });
      parser.parse();
      console.log('SAMPLE', sample);
      // console.log('FUNCTIONS', parser.functions);
      // console.log('MACROS', parser.macros);
      console.log('ENUMS', parser.enums);
    }
  });
});
