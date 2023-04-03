import fs from 'fs/promises';
import { GmlLexer } from './lexer.js';
import { GmlParser } from './parser.js';

const parser = new GmlParser();

describe('Parser', function () {
  it('can parse sample files', async function () {
    const samples = await fs.readdir('./samples');
    for (const sample of samples) {
      const filePath = `./samples/${sample}`;
      const code = await fs.readFile(filePath, 'utf-8');
      const lexingResult = GmlLexer.tokenize(code);
      if (result.errors.length) {
        console.dir(result, { depth: null });
        throw new Error('Lexer failed to lex sample file: ' + filePath);
      }
    }
  });
});
