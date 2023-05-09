import { pathy } from '@bscotch/pathy';
import { ok } from 'assert';
import { expect } from 'chai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { GmlParser } from './parser.js';
import { GmlSymbolVisitor } from './symbols.visitor.js';

const visitor = new GmlSymbolVisitor();

dotenv.config();

function showParserErrors(parser: GmlParser, filepath?: string) {
  if (!parser.errors.length) return;
  console.error(
    parser.errors.map((e) => ({
      loc: `${filepath || ''}:${e.token.startLine}:${e.token.startColumn}`,
      msg: e.message,
      // @ts-ignore
      prior: e.previousToken,
      token: e.token,
    })),
  );
}

describe('Visitor', function () {
  it('can visit sample files', async function () {
    const parser = new GmlParser();
    const samples = await fs.readdir('./samples');
    for (const sample of samples) {
      const filePath = `./samples/${sample}`;
      const code = await fs.readFile(filePath, 'utf-8');
      const { cst } = parser.parse(code);
      ok(cst);
      const ast = visitor.visit(cst);
      console.log(ast);
    }
  });

  xit('can visit sample project', async function () {
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
      const cst = parser.parse(code);
      showParserErrors(parser, file.absolute);
      expect(cst).to.exist;
      expect(parser.errors).to.have.length(0);
      // console.log(cst);
    }
  });
});
