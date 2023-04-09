import { expect } from 'chai';
import fs from 'fs/promises';
import { GmlParser } from './parser.js';

describe('Parser', function () {
  it('can parse simple expressions', function () {
    const parser = new GmlParser();
    const cst = parser.parse('(1 + 2 * 3) + (hello / (world || undefined))');
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
      const filePath = `./samples/${sample}`;
      const code = await fs.readFile(filePath, 'utf-8');
      const cst = parser.parse(code);
      expect(cst).to.exist;
      console.log(
        parser.errors.map((e) => ({
          msg: e.message,
          // @ts-ignore
          prior: e.previousToken?.image,
          token: e.token.image,
        })),
      );
      expect(parser.errors).to.have.length(0);
      // console.log(cst);
    }
  });
});
