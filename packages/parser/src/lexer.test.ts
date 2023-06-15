import { undent } from '@bscotch/utility';
import { ILexingResult } from 'chevrotain';
import fs from 'fs/promises';
import { GmlLexer } from './lexer.js';
import { logger } from './logger.js';

describe('Lexer', function () {
  it('can lex strings', function () {
    const sample = undent`
      "hello"
      @"world"
      @'singlez'
      @"multi
      line
      one!"
    `;
    const result = GmlLexer.tokenize(sample);
    if (result.errors.length) {
      logger.dir(result, { depth: null });
      throw new Error('Lexer failed to lex sample file: ' + sample);
    }
  });

  it('can lex templates', function () {
    const sample = '$"a template {woo+3}!"';
    const result = GmlLexer.tokenize(sample);
    if (result.errors.length) {
      logger.dir(result, { depth: null });
      throw new Error('Lexer failed to lex sample: ' + sample);
    }
  });

  it('can lex GML style JSDocs', function () {
    const sample = undent`
      /// @description This is a description
      /// @param {string} a
      /// @param {number} b
      /// @returns {string}
      function myFunc(a, b) {}
    `;
    const result = GmlLexer.tokenize(sample);
    if (result.errors.length) {
      logger.dir(result, { depth: null });
      throw new Error('Lexer failed to lex sample: ' + sample);
    }
  });

  it('can lex JS style JSDocs', function () {
    const sample = undent`
      /**
       * @description This is a description
       * @param {string} a
       * @param {number} b
       * @returns {string}
       */
      function myFunc(a, b) {}
    `;
    const result = GmlLexer.tokenize(sample);
    if (result.errors.length) {
      logger.dir(result.errors, { depth: null });
      throw new Error('Lexer failed to lex sample: ' + sample);
    }
  });

  it('can lex sample files', async function () {
    const samples = await fs.readdir('./samples');
    for (const sample of samples) {
      const filePath = `./samples/${sample}`;
      if (await fs.stat(filePath).then((s) => s.isDirectory())) {
        continue;
      }
      const code = await fs.readFile(filePath, 'utf-8');
      const result = GmlLexer.tokenize(code);
      if (result.errors.length) {
        logger.dir(result, { depth: null });
        throw new Error('Lexer failed to lex sample file: ' + filePath);
      }
    }
  });
});

function logResult(result: ILexingResult) {
  logger.log(
    JSON.stringify(
      result.tokens,
      ['image', 'startOffset', 'tokenType', 'name', 'PUSH_MODE', 'POP_MODE'],
      2,
    ),
  );
}
