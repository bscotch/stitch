/**
 * Formatter options.
 *
 * Every option that touches a style point people disagree on has a
 * `'preserve'` choice, which leaves that aspect of the code as written.
 * The formatter never reflows code: line breaks inside statements are
 * always kept.
 */
export interface FormatOptions {
  /**
   * Indentation character. `'auto'` uses whichever of tabs or spaces the
   * file already mostly uses, falling back to `indentFallback`.
   */
  indentStyle: 'tab' | 'space' | 'auto';
  indentFallback: 'tab' | 'space';
  /**
   * Columns per indentation level (and tab width, for alignment).
   * `'auto'` detects 2- or 4-space indentation in space-indented files,
   * and otherwise uses 4.
   */
  indentWidth: number | 'auto';
  /**
   * Indentation of directive lines (`#macro`, `#region`, `#endregion`,
   * `#define`...). `'preserve'` keeps their original column, since they
   * are often written flush-left.
   */
  directiveIndent: 'indent' | 'preserve';
  /**
   * Indentation of comments on their own line. `'preserve'` keeps a
   * comment's offset from its enclosing block (e.g. commented-out code
   * that is indented as if it were still nested), unless that would put
   * it outside the block.
   */
  commentIndent: 'structural' | 'preserve';
  /**
   * How to indent lines that continue a statement (e.g. a line starting
   * with `&&`):
   * - `'structural'`: one level deeper than the statement.
   * - `'preserve'`: keep the line's position relative to the statement's
   *   first line (e.g. hand-aligned arguments), unless it was outdented.
   */
  continuationIndent: 'structural' | 'preserve';
  /** Line endings. `'auto'` keeps the file's dominant line ending. */
  endOfLine: 'lf' | 'crlf' | 'auto';
  /** Maximum consecutive blank lines to keep */
  maxBlankLines: number;
  /** Ensure the file ends with exactly one line break */
  finalNewline: 'always' | 'preserve';

  /** Where `else` goes after a `}` */
  elsePlacement: 'sameLine' | 'newLine' | 'preserve';
  /** Move a block's `{` up onto the line of its `if`, `function`, etc. */
  openBrace: 'sameLine' | 'preserve';
  /**
   * Add a missing `;` after statements that take one. With
   * `'addExceptAfterBrace'`, statements ending in `}` (like
   * `f = function () {...}`) are left as written.
   */
  semicolons: 'add' | 'addExceptAfterBrace' | 'preserve';
  /** Wrap `if`/`while`/`switch`/`with`/`repeat` conditions in parentheses */
  conditionParens: 'add' | 'preserve';

  /** Space between a control keyword and `(`, as in `if (` */
  keywordParenSpace: 'space' | 'none' | 'preserve';
  /** Space after commas */
  commaSpace: 'space' | 'preserve';
  /** Spacing around a struct literal's `:` (`key : value` vs `key: value`) */
  structColon: 'spaced' | 'after' | 'preserve';
  /** Spacing around assignment operators (`=`, `+=`, etc.) */
  assignmentSpacing: 'spaced' | 'preserve';
  /** Spacing around the `=` of a function parameter's default value */
  parameterDefaultSpacing: 'spaced' | 'tight' | 'preserve';
  /** Spacing around comparison, equality, logical and nullish operators */
  comparisonSpacing: 'spaced' | 'preserve';
  /** Spacing around arithmetic, bitwise and shift operators */
  arithmeticSpacing: 'spaced' | 'preserve';
  /**
   * When adding spaces, keep extra existing spaces (e.g. aligned `=` signs
   * on consecutive lines) instead of collapsing them to one.
   */
  keepAlignment: boolean;
  /** Spaces between a function name or `function` keyword and its `(` */
  functionParenSpace: 'none' | 'preserve';
}

export type PresetName = 'bscotch' | 'standard';

/**
 * Matches Butterscotch Shenanigans' hand-formatted code: normalizes only
 * near-universal conventions and preserves the rest, for minimal diffs.
 */
export const bscotchPreset: FormatOptions = {
  indentStyle: 'auto',
  indentFallback: 'tab',
  indentWidth: 'auto',
  directiveIndent: 'preserve',
  commentIndent: 'preserve',
  continuationIndent: 'preserve',
  endOfLine: 'auto',
  maxBlankLines: 1,
  finalNewline: 'preserve',
  elsePlacement: 'newLine',
  openBrace: 'sameLine',
  semicolons: 'addExceptAfterBrace',
  conditionParens: 'preserve',
  keywordParenSpace: 'space',
  commaSpace: 'space',
  structColon: 'spaced',
  assignmentSpacing: 'spaced',
  parameterDefaultSpacing: 'tight',
  comparisonSpacing: 'spaced',
  arithmeticSpacing: 'preserve',
  keepAlignment: true,
  functionParenSpace: 'none',
};

/** A fully-normalizing style */
export const standardPreset: FormatOptions = {
  indentStyle: 'auto',
  indentFallback: 'tab',
  indentWidth: 4,
  directiveIndent: 'indent',
  commentIndent: 'structural',
  continuationIndent: 'structural',
  endOfLine: 'auto',
  maxBlankLines: 1,
  finalNewline: 'always',
  elsePlacement: 'sameLine',
  openBrace: 'sameLine',
  semicolons: 'add',
  conditionParens: 'add',
  keywordParenSpace: 'space',
  commaSpace: 'space',
  structColon: 'after',
  assignmentSpacing: 'spaced',
  parameterDefaultSpacing: 'spaced',
  comparisonSpacing: 'spaced',
  arithmeticSpacing: 'spaced',
  keepAlignment: false,
  functionParenSpace: 'none',
};

export const presets: Record<PresetName, FormatOptions> = {
  bscotch: bscotchPreset,
  standard: standardPreset,
};

export function resolveOptions(
  options: Partial<FormatOptions> & { preset?: PresetName } = {},
): FormatOptions {
  const { preset = 'standard', ...overrides } = options;
  return { ...presets[preset], ...overrides };
}
