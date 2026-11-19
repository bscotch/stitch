import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathy } from '@bscotch/pathy';
import { undent } from '@bscotch/utility';
import type { IRecognitionException } from 'chevrotain';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { logger } from './logger.ts';
import { GmlParser } from './parser.ts';
import { Type } from './types.ts';
import { ok } from './util.ts';

dotenv.config();

function showErrors(
  parser: GmlParser | IRecognitionException[],
  filepath?: string,
) {
  const errors = Array.isArray(parser) ? parser : parser.errors;
  if (!errors.length) return;
  logger.error(
    errors.map((e) => ({
      loc: `${filepath || ''}:${e.token.startLine}:${e.token.startColumn}`,
      msg: e.message,
      token: e.token.image,
      resynced: e.resyncedTokens.map((t) => ({
        image: t.image,
        startLine: t.startLine,
        startColumn: t.startColumn,
      })),
    })),
  );
}

describe('Parser', function () {
  it('can get types from typestrings', function () {
    assert.equal(
      Type.fromFeatherString('Array', new Map(), false)[0].kind,
      'Array',
    );
    const stringArray = Type.fromFeatherString(
      'Array<string>',
      new Map(),
      false,
    )[0];
    assert.equal(stringArray.kind, 'Array');
    assert.equal(stringArray.items!.kind, 'String');
    const dsMap = Type.fromFeatherString(
      'Id.DsMap[String,Real]',
      new Map(),
      false,
    )[0];
    assert.equal(dsMap.kind, 'Id.DsMap');
    const dsMapItems = dsMap.items!.type;
    assert.equal(dsMapItems.length, 2);
    assert.equal(dsMapItems[0].kind, 'String');
    assert.equal(dsMapItems[1].kind, 'Real');
  });

  it('can parse cross-referencing types', function () {
    const knownTypes = new Map();
    const arrayOfStructs = Type.fromFeatherString(
      'Array<Struct.Hello>',
      knownTypes,
      true,
    )[0];
    knownTypes.set('Struct.Hello', arrayOfStructs.items!.type[0]);
    const structType = Type.fromFeatherString(
      'Struct.Hello',
      knownTypes,
      false,
    )[0];

    ok(knownTypes.get('Struct.Hello') === structType);
    assert.equal(arrayOfStructs.kind, 'Array');
    assert.equal(arrayOfStructs.items!.kind, 'Struct');
    ok(arrayOfStructs.items!.type[0] === structType);
    assert.equal(arrayOfStructs.items!.type[0].name, 'Hello');
  });

  it('can parse complex typestrings', function () {
    const complexType = Type.fromFeatherString(
      'Array<string OR Array<Real>>|Struct.Hello OR Id.DsMap[String,Real]',
      new Map(),
      true,
    );
    const [arrayType, structType, dsMapType] = complexType;
    assert.equal(complexType.length, 3);
    assert.equal(arrayType.kind, 'Array');
    const arrayItems = arrayType.items!.type;
    assert.equal(arrayItems.length, 2);
    assert.equal(arrayItems[0].kind, 'String');
    assert.equal(arrayItems[1].kind, 'Array');
    assert.equal(arrayItems[1].items!.kind, 'Real');
    assert.equal(structType.kind, 'Struct');
    assert.equal(structType.name, 'Hello');
    assert.equal(dsMapType.kind, 'Id.DsMap');
    const dsMapItems = dsMapType.items!.type;
    assert.equal(dsMapItems.length, 2);
    assert.equal(dsMapItems[0].kind, 'String');
    assert.equal(dsMapItems[1].kind, 'Real');
  });

  it('can parse simple expressions', function () {
    const parser = new GmlParser();
    const { cst } = parser.parse(
      '(1 + 2 * 3) + (hello / (world || undefined))',
    );
    assert.equal(parser.errors.length, 0);
    assert.ok(cst != null);
  });

  it('can get errors for invalid simple expressions', function () {
    const parser = new GmlParser();
    const { errors } = parser.parse(
      '(1 + 2 * 3) + hello / world || undefined +',
    );
    assert.equal(parser.errors.length, 1);
    assert.equal(errors.length, 1);
  });

  it('can parse complex expressions', function () {
    const parser = new GmlParser();
    const { cst } = parser.parse(
      '1 + 2 * 3 + hello / world[no+true] || undefined + (1 + 2 * 3 + hello / world || undefined ^^ functionCall(10+3,undefined,,))',
    );
    assert.equal(parser.errors.length, 0);
    assert.ok(cst != null);
    // logger.log(
    //   GmlParser.jsonify(
    //     // @ts-expect-error
    //     cst!.children.statement[0].children.expressionStatement[0].children
    //       .expression[0],
    //   ),
    // );
  });

  it('can parse GML style JSDocs', function () {
    const parser = new GmlParser();
    const { cst } = parser.parse(
      undent`
        /// @description This is a description
        /// @param {string} a
        /// @param {number} b
        /// @returns {string}
        function myFunc(a, b) {}
      `,
    );
    showErrors(parser);
    assert.equal(parser.errors.length, 0);
    assert.ok(cst != null);
  });

  it('can parse sample files', async function () {
    const parser = new GmlParser();
    const samples = await fs.readdir('./samples');
    for (const sample of samples) {
      // logger.log('Parsing', sample);
      if (!sample.endsWith('.gml')) {
        continue;
      }
      const filePath = `./samples/${sample}`;
      const code = await fs.readFile(filePath, 'utf-8');
      const { cst } = parser.parse(code);
      showErrors(parser, filePath);
      assert.ok(cst != null);
      assert.equal(parser.errors.length, 0);
      // logger.log(cst);
    }
  });

  it.skip('can parse sample project', async function () {
    const projectDir = process.env.GML_PARSER_SAMPLE_PROJECT_DIR;
    assert.ok(
      projectDir != null,
      'A dotenv file should provide a path to a full sample project, as env var GML_PARSER_SAMPLE_PROJECT_DIR',
    );
    const dir = pathy(projectDir);
    const files = await dir.listChildrenRecursively({
      includeExtension: ['.gml'],
    });
    assert.ok(files.length > 0);

    const parser = new GmlParser();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const code = await file.read<string>();
      const { cst } = parser.parse(code);
      showErrors(parser, file.absolute);
      assert.ok(cst != null);
      assert.equal(parser.errors.length, 0);
      // logger.log(cst);
    }
  });
});
