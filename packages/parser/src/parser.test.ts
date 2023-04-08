import fs from 'fs/promises';
import { GmlParser } from './parser.js';

describe('Parser', function () {
  it('can parse sample files', async function () {
    const parser = new GmlParser();
    const samples = await fs.readdir('./samples');
    for (const sample of samples) {
      const filePath = `./samples/${sample}`;
      const code = await fs.readFile(filePath, 'utf-8');
      const cst = parser.parse(code);
      console.log(
        parser.errors.map((e) => ({
          msg: e.message,
          // @ts-ignore
          prior: e.previousToken?.image,
          token: e.token.image,
        })),
      );
      console.log(cst);
    }
  });
});
