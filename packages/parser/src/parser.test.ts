import { pathy } from '@bscotch/pathy';
import { undent } from '@bscotch/utility';
import { expect } from 'chai';
import type { IRecognitionException } from 'chevrotain';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { GmlParser } from './parser.js';
import { Type } from './project.impl.js';

dotenv.config();

function showErrors(
  parser: GmlParser | IRecognitionException[],
  filepath?: string,
) {
  const errors = Array.isArray(parser) ? parser : parser.errors;
  if (!errors.length) return;
  console.error(
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

describe.only('Parser', function () {
  it.only('can parse Feather types', function () {
    const parser = new GmlParser();
    let { cst } = parser.parseTypeString('Array');
    expect(
      cst.children.jsdocType[0].children.JsdocIdentifier[0].image,
    ).to.equal('Array');
    expect(parser.errors.length).to.equal(0);

    ({ cst } = parser.parseTypeString(
      'Array<string OR Array<Real>> or Struct.Hello or Id.Map<String,Real>',
    ));
    expect(parser.errors.length).to.equal(0);
    expect(cst.children.jsdocType.length).to.equal(3);
    const [first, second, third] = cst.children.jsdocType;
    expect(first.children.JsdocIdentifier[0].image).to.equal('Array');
    const firstTypes = first.children.jsdocTypeUnion![0].children.jsdocType;
    expect(firstTypes.length).to.equal(2);
    expect(second.children.JsdocIdentifier[0].image).to.equal('Struct.Hello');
    expect(third.children.JsdocIdentifier[0].image).to.equal('Id.Map');
  });

  it.only('can get types from typestrings', function () {
    expect(Type.from('Array').kind).to.equal('Array');
    const stringArray = Type.from('Array<string>');
    expect(stringArray.kind).to.equal('Array');
    expect(stringArray.items!.kind).to.equal('String');

    // TODO: Add some more tests!
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
    // console.log(
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
      console.log('Parsing', sample);
      const filePath = `./samples/${sample}`;
      const code = await fs.readFile(filePath, 'utf-8');
      const { cst } = parser.parse(code);
      showErrors(parser, filePath);
      expect(cst).to.exist;
      expect(parser.errors).to.have.length(0);
      // console.log(cst);
    }
  });

  it('can parse sample project', async function () {
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
      console.log(i, 'Parsing:', file.relative);
      const code = await file.read<string>();
      const { cst } = parser.parse(code);
      showErrors(parser, file.absolute);
      expect(cst).to.exist;
      expect(parser.errors).to.have.length(0);
      // console.log(cst);
    }
  });
});
