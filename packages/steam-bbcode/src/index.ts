import { Marked } from 'marked';
import { markedBbcodeExtension } from './lib.ts';
export { markedBbcodeExtension } from './lib.ts';

const marked = new Marked(markedBbcodeExtension);

/**
 * Convert Markdown (or HTML) to Steam-compatible BBCode. Also returns the HTML content.
 */
export function md2bbcode(source: string): {
  source: string;
  bbcode: string;
  // html: string;
} {
  const bbcode = (marked.parse(source) as string).replaceAll('&#39;', "'");
  return {
    source,
    bbcode,
  };
}
