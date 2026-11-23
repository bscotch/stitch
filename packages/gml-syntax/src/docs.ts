import type { NodeBase } from './ast.ts';
import type { ParseResult } from './parser.ts';
import { isDocComment, type Token } from './tokens.ts';

/** Index of the first token starting at or after `offset` */
export function tokenIndexAt(tokens: Token[], offset: number): number {
  let low = 0;
  let high = tokens.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (tokens[mid].start < offset) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * The doc comments (`///` lines or a `/** *\/` block) directly preceding
 * a node, in source order.
 *
 * Doc comments belong to a node when only whitespace and single line breaks
 * separate them from it and from each other. A blank line, a regular
 * comment, or code breaks the association.
 */
export function leadingDocComments(
  parsed: Pick<ParseResult, 'tokens'>,
  node: NodeBase,
): Token[] {
  const { tokens } = parsed;
  const docs: Token[] = [];
  let newlines = 0;
  for (let i = tokenIndexAt(tokens, node.start) - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.kind === 'whitespace') continue;
    if (token.kind === 'newline') {
      if (++newlines > 1) break;
      continue;
    }
    if (!isDocComment(token.kind)) break;
    docs.unshift(token);
    newlines = 0;
  }
  return docs;
}
