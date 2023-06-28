import { pathy } from '@bscotch/pathy';
import { undent } from '@bscotch/utility';
import { expect } from 'chai';
import type { IRecognitionException } from 'chevrotain';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { logger } from './logger.js';
import { GmlParser } from './parser.js';
import { typeFromFeatherString } from './types.feather.js';
import { ok } from './util.js';

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
    expect(typeFromFeatherString('Array', new Map()).kind).to.equal('Array');
    const stringArray = typeFromFeatherString('Array<string>', new Map());
    expect(stringArray.kind).to.equal('Array');
    expect(stringArray.contains!.kind).to.equal('String');
    const dsMap = typeFromFeatherString('Id.DsMap[String,Real]', new Map());
    expect(dsMap.kind).to.equal('Id.DsMap');
    expect(dsMap.contains!.kind).to.equal('Union');
    expect(dsMap.contains!.types!.length).to.equal(2);
    expect(dsMap.contains!.types![0].kind).to.equal('String');
    expect(dsMap.contains!.types![1].kind).to.equal('Real');
  });

  it('can parse cross-referencing types', function () {
    const knownTypes = new Map();
    const arrayOfStructs = typeFromFeatherString(
      'Array<Struct.Hello>',
      knownTypes,
    );
    const structType = typeFromFeatherString('Struct.Hello', knownTypes);

    ok(knownTypes.get('Struct.Hello') === structType);
    expect(arrayOfStructs.kind).to.equal('Array');
    expect(arrayOfStructs.contains!.kind).to.equal('Struct');
    ok(arrayOfStructs.contains === structType);
    expect(arrayOfStructs.contains!.name).to.equal('Hello');
  });

  it('can parse complex typestrings', function () {
    const complexType = typeFromFeatherString(
      'Array<string OR Array<Real>>|Struct.Hello OR Id.DsMap[String,Real]',
      new Map(),
    );
    expect(complexType.kind).to.equal('Union');
    const types = complexType.types!;
    expect(types.length).to.equal(3);
    expect(types[0].kind).to.equal('Array');
    expect(types[0].contains!.kind).to.equal('Union');
    expect(types[0].contains!.types!.length).to.equal(2);
    expect(types[0].contains!.types![0].kind).to.equal('String');
    expect(types[0].contains!.types![1].kind).to.equal('Array');
    expect(types[0].contains!.types![1].contains!.kind).to.equal('Real');
  });

  it('can parse simple expressions', function () {
    const parser = new GmlParser();
    const { cst } = parser.parse(
      '(1 + 2 * 3) + (hello / (world || undefined))',
    );
    expect(parser.errors.length).to.equal(0);
    expect(cst).to.exist;
  });

  it('can get errors for invalid simple expressions', function () {
    const parser = new GmlParser();
    const { cst, errors } = parser.parse(
      '(1 + 2 * 3) + hello / world || undefined +',
    );
    expect(parser.errors.length).to.equal(1);
    expect(errors.length).to.equal(1);
  });

  it('can parse complex expressions', function () {
    const parser = new GmlParser();
    const { cst } = parser.parse(
      '1 + 2 * 3 + hello / world[no+true] || undefined + (1 + 2 * 3 + hello / world || undefined ^^ functionCall(10+3,undefined,,))',
    );
    expect(parser.errors.length).to.equal(0);
    expect(cst).to.exist;
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
    expect(parser.errors.length).to.equal(0);
    expect(cst).to.exist;
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
      expect(cst).to.exist;
      expect(parser.errors).to.have.length(0);
      // logger.log(cst);
    }
  });

  xit('can parse sample project', async function () {
    const projectDir = process.env.GML_PARSER_SAMPLE_PROJECT_DIR;
    expect(
      projectDir,
      'A dotenv file should provide a path to a full sample project, as env var GML_PARSER_SAMPLE_PROJECT_DIR',
    ).to.exist;
    const dir = pathy(projectDir);
    const files = await dir.listChildrenRecursively({
      includeExtension: ['.gml'],
    });
    expect(files.length).to.be.greaterThan(0);

    const parser = new GmlParser();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const code = await file.read<string>();
      const { cst } = parser.parse(code);
      showErrors(parser, file.absolute);
      expect(cst).to.exist;
      expect(parser.errors).to.have.length(0);
      // logger.log(cst);
    }
  });
});
