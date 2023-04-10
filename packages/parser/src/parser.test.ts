import { pathy } from '@bscotch/pathy';
import { expect } from 'chai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { GmlParser } from './parser.js';

dotenv.config();

describe('Parser', function () {
  it('can parse simple expressions', function () {
    const parser = new GmlParser();
    const cst = parser.parse('(1 + 2 * 3) + (hello / (world || undefined))');
    console.log(parser.errors);
    expect(parser.errors.length).to.equal(0);
    expect(cst).to.exist;
  });

  it('can get errors for invalid simple expressions', function () {
    const parser = new GmlParser();
    const cst = parser.parse('(1 + 2 * 3) + hello / world || undefined +');
    expect(parser.errors.length).to.equal(1);
    expect(cst).not.to.exist;
  });

  it('can parse complex expressions', function () {
    const parser = new GmlParser();
    const cst = parser.parse(
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

  it('can parse sample files', async function () {
    const parser = new GmlParser();
    const samples = await fs.readdir('./samples');
    for (const sample of samples) {
      console.log('Parsing', sample);
      const filePath = `./samples/${sample}`;
      const code = await fs.readFile(filePath, 'utf-8');
      const cst = parser.parse(code);
      console.log(
        parser.errors.map((e) => ({
          msg: e.message,
          // @ts-ignore
          prior: e.previousToken,
          token: e.token,
        })),
      );
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
    for (const file of files) {
      console.log('Reading file', file.relative);
      const code = await file.read<string>();
      const cst = parser.parse(code);
      console.log(
        parser.errors.map((e) => ({
          msg: e.message,
          // @ts-ignore
          prior: e.previousToken,
          token: e.token,
        })),
      );
      expect(cst).to.exist;
      expect(parser.errors).to.have.length(0);
      // console.log(cst);
    }
  });
});
