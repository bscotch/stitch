import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { md2bbcode } from './index.ts';

/** Sample Markdown containing all kinds of Steam-compatible components */
const sample = fs.readFileSync('samples/input.md', 'utf-8');
const expectedSampleBbcode = fs.readFileSync('samples/output.bbcode', 'utf-8');

describe('BBCode generator', () => {
  it('should convert Markdown to BBCode', () => {
    const converted = md2bbcode(sample).bbcode;
    // fs.writeFileSync('samples/output.bbcode', converted);
    assert.equal(expectedSampleBbcode, converted);
  });
});
