/**
 * Finding a file's doc comments and working out what each one documents.
 */
import {
  isDocComment,
  isTrivia,
  parseDocComment,
  type DocComment,
  type DocTag,
  type DocTagKind,
  type ParseResult,
  type Token,
} from '@bscotch/gml-syntax';

/** A standalone variable declaration in a doc comment (`@localvar`, `@instancevar`, `@globalvar`) */
export interface DocVariable {
  kind: 'localvar' | 'instancevar' | 'globalvar';
  tag: DocTag;
  /** The doc comment it was found in */
  doc: DocComment;
}

export interface FileDocs {
  /** Every doc comment, in order */
  all: DocComment[];
  /** Doc comments that document the code starting at a given offset */
  attached: Map<number, DocComment>;
  /** Variables declared by doc comments */
  variables: DocVariable[];
}

const variableTags = new Set<DocTagKind>([
  'localvar',
  'instancevar',
  'globalvar',
]);

/**
 * Find and parse a file's doc comments.
 *
 * Consecutive doc comment lines (with nothing but single line breaks
 * between them) form one doc comment. A doc comment documents the code
 * that directly follows it on the next line. Variable tags (`@localvar`,
 * etc.) declare variables on their own and are not attached to code.
 */
export function findDocs(
  parsed: Pick<ParseResult, 'text' | 'tokens'>,
): FileDocs {
  const { tokens, text } = parsed;
  const docs: FileDocs = { all: [], attached: new Map(), variables: [] };
  let i = 0;
  while (i < tokens.length) {
    if (!isDocComment(tokens[i].kind)) {
      i++;
      continue;
    }
    // Collect a run of doc comments
    const run: Token[] = [tokens[i]];
    let j = i + 1;
    let newlines = 0;
    let next: Token | undefined;
    for (; j < tokens.length; j++) {
      const token = tokens[j];
      if (token.kind === 'whitespace') continue;
      if (token.kind === 'newline') {
        newlines++;
        continue;
      }
      if (isDocComment(token.kind)) {
        if (newlines > 1) break; // A blank line separates doc comments
        run.push(token);
        newlines = 0;
        continue;
      }
      // Code (or another kind of trivia) follows
      if (!isTrivia(token.kind)) next = token;
      break;
    }
    i = j;
    const doc = parseDocComment(text, run);
    docs.all.push(doc);
    const plain = doc.tags.filter((t) => !variableTags.has(t.kind));
    for (const tag of doc.tags) {
      if (variableTags.has(tag.kind)) {
        docs.variables.push({
          kind: tag.kind as DocVariable['kind'],
          tag,
          doc,
        });
      }
    }
    const onlyVariables = doc.tags.length > 0 && plain.length === 0;
    // Blank lines usually separate a doc comment from code, but are
    // commonly used (and accepted) between a function and its docs
    if (next && (newlines <= 1 || next.kind === 'function') && !onlyVariables) {
      docs.attached.set(next.start, doc);
    }
  }
  return docs;
}

/** The first tag of a kind */
export function docTag(
  doc: DocComment | undefined,
  kind: DocTagKind,
): DocTag | undefined {
  return doc?.tags.find((t) => t.kind === kind);
}

export function docTags(
  doc: DocComment | undefined,
  kind: DocTagKind,
): DocTag[] {
  return doc?.tags.filter((t) => t.kind === kind) || [];
}

/**
 * The description of the documented item: the leading text, an explicit
 * `@description`, or (for `@type`) the text after the type.
 */
export function docDescription(
  doc: DocComment | undefined,
): string | undefined {
  if (!doc) return undefined;
  const parts = [
    doc.description?.text,
    docTag(doc, 'description')?.description?.text,
  ].filter(Boolean);
  if (!parts.length) {
    const typed = docTag(doc, 'type');
    if (typed?.description?.text) parts.push(typed.description.text);
  }
  return parts.join('\n\n').trim() || undefined;
}
