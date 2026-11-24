/**
 * The GML formatter.
 *
 * Formatting works on the lossless token stream from `@bscotch/gml-syntax`.
 * Every token and comment is kept, in order. The formatter only rewrites the
 * whitespace *between* tokens, plus two optional insertions (a missing `;`,
 * and parentheses around conditions). It never reflows code: line breaks
 * within statements are kept.
 *
 * It works in three steps:
 * 1. Use the syntax tree to classify tokens (operators, statement starts,
 *    list items, ...) and plan insertions.
 * 2. Walk the tokens, rebuilding the gap before each one: either a line
 *    break plus a computed indentation, or same-line spacing.
 * 3. Verify that the output has exactly the original tokens (plus any
 *    planned insertions). If not, throw instead of returning broken code.
 */
import {
  isComment,
  isTrivia,
  lex,
  parse,
  walk,
  type Node,
  type ParseResult,
  type SyntaxDiagnostic,
  type Token,
  type TokenKind,
} from '@bscotch/gml-syntax';
import {
  resolveOptions,
  type FormatOptions,
  type PresetName,
} from './options.ts';

export class GmlFormatError extends Error {
  readonly diagnostics: SyntaxDiagnostic[];
  constructor(message: string, diagnostics: SyntaxDiagnostic[] = []) {
    super(message);
    this.name = 'GmlFormatError';
    this.diagnostics = diagnostics;
  }
}

export interface FormatResult {
  text: string;
  changed: boolean;
}

/**
 * Format GML source. Throws a `GmlFormatError` if the source has syntax
 * errors (formatting broken code is unsafe).
 */
export function formatGml(
  text: string,
  options: Partial<FormatOptions> & { preset?: PresetName } = {},
): FormatResult {
  const resolved = resolveOptions(options);
  const parsed = parse(text);
  const errors = parsed.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length) {
    throw new GmlFormatError(
      `Cannot format GML with syntax errors: ${errors[0].message}`,
      errors,
    );
  }
  const output = new Formatter(parsed, resolved).format();
  verify(parsed, output.text, output.insertions);
  return { text: output.text, changed: output.text !== text };
}

//#region Classification

type OperatorClass =
  'assignment' | 'parameterDefault' | 'comparison' | 'arithmetic';

const comparisonOperators = new Set([
  '==',
  '!=',
  '=',
  '<',
  '<=',
  '>',
  '>=',
  '&&',
  '||',
  '^^',
  '??',
]);

const openers = new Set<TokenKind>([
  '{',
  '(',
  '[',
  '[@',
  '[?',
  '[|',
  '[#',
  '[$',
]);
const closers = new Set<TokenKind>(['}', ')', ']']);
/** Keywords that continue a statement but begin a line at statement level */
const statementLevelKeywords = new Set<TokenKind>([
  'else',
  'catch',
  'finally',
  'until',
]);
const conditionKeywords = new Set<TokenKind>([
  'if',
  'while',
  'for',
  'with',
  'repeat',
  'switch',
  'catch',
]);

interface Interval {
  start: number;
  end: number;
}

/** Everything the formatter needs to know about the source */
interface Analysis {
  /** Offsets where statements (and switch cases) start */
  statementStarts: Set<number>;
  /** Statements, sorted by start offset */
  statements: Interval[];
  /** Ranges that get an extra indentation level (case/unbraced bodies) */
  indentIntervals: Interval[];
  /** Offsets where list items (args, elements, properties...) start */
  listItemStarts: Set<number>;
  /** Ranges whose internal whitespace must not be touched */
  verbatim: Interval[];
  /** Operator token offsets, by class */
  operators: Map<number, OperatorClass>;
  /** Offsets of prefix unary operator tokens */
  unaryOperators: Set<number>;
  structColons: Set<number>;
  /** `(` tokens directly following a callee or function name */
  callParens: Set<number>;
  /**
   * `{` tokens that belong to a preceding header (like `if x {` or
   * `function f() {`), mapped to the offset where that header starts.
   * Their contents are indented relative to the header's line.
   */
  headerBraces: Map<number, number>;
  /** Insertions, by token offset */
  prefixes: Map<number, string>;
  suffixes: Map<number, string>;
}

function analyze(
  parsed: ParseResult,
  options: FormatOptions,
  significant: Token[],
): Analysis {
  const { text } = parsed;
  const analysis: Analysis = {
    statementStarts: new Set(),
    statements: [],
    indentIntervals: [],
    listItemStarts: new Set(),
    verbatim: [],
    operators: new Map(),
    unaryOperators: new Set(),
    structColons: new Set(),
    callParens: new Set(),
    headerBraces: new Map(),
    prefixes: new Map(),
    suffixes: new Map(),
  };

  /** The first significant token at or after `offset` */
  const tokenAt = (offset: number): Token => {
    let low = 0;
    let high = significant.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (significant[mid].start < offset) low = mid + 1;
      else high = mid;
    }
    return significant[low];
  };
  /** The last significant token ending at or before `offset` */
  const tokenEndingAt = (offset: number): Token => {
    let low = 0;
    let high = significant.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (significant[mid].end <= offset) low = mid;
      else high = mid - 1;
    }
    return significant[low];
  };
  /** Register a block's `{` as belonging to the header starting at `owner` */
  const addHeaderBrace = (node: Node | null | undefined, owner: number) => {
    if (node?.kind === 'Block' && text[node.start] === '{') {
      analysis.headerBraces.set(node.start, owner);
    }
  };
  /** The token just before a node (e.g. the `else` before its block) */
  const tokenBefore = (node: Node) => tokenEndingAt(node.start);
  const addUnbracedBody = (body: Node | null) => {
    if (body && body.kind !== 'Block' && body.kind !== 'IfStatement') {
      analysis.indentIntervals.push({ start: body.start, end: body.end });
    }
  };
  const addSemicolon = (node: Node) => {
    if (options.semicolons === 'preserve') return;
    if (text[node.end - 1] === ';') return;
    const last = tokenEndingAt(node.end);
    if (options.semicolons === 'addExceptAfterBrace' && last.kind === '}') {
      return;
    }
    analysis.suffixes.set(last.start, ';');
  };
  const addConditionParens = (expression: Node) => {
    if (options.conditionParens !== 'add') return;
    if (expression.kind === 'ParenthesizedExpression') return;
    if (expression.kind === 'MissingExpression') return;
    analysis.prefixes.set(tokenAt(expression.start).start, '(');
    const last = tokenEndingAt(expression.end);
    analysis.suffixes.set(
      last.start,
      `)${analysis.suffixes.get(last.start) ?? ''}`,
    );
  };

  const forClauses = new Set<Node>();
  const statementKinds = new Set([
    'Block',
    'VariableDeclaration',
    'Assignment',
    'ExpressionStatement',
    'IfStatement',
    'WhileStatement',
    'DoUntilStatement',
    'ForStatement',
    'RepeatStatement',
    'WithStatement',
    'SwitchStatement',
    'TryStatement',
    'ReturnStatement',
    'ThrowStatement',
    'BreakStatement',
    'ContinueStatement',
    'ExitStatement',
    'FunctionDeclaration',
    'EnumDeclaration',
    'MacroDeclaration',
    'EmptyStatement',
  ]);

  walk(parsed.ast, (node) => {
    if (statementKinds.has(node.kind) && !forClauses.has(node)) {
      analysis.statementStarts.add(node.start);
      analysis.statements.push({ start: node.start, end: node.end });
    }
    switch (node.kind) {
      case 'MacroDeclaration':
      case 'TemplateString':
        analysis.verbatim.push({ start: node.start, end: node.end });
        return false;
      case 'Assignment':
        analysis.operators.set(tokenAt(node.target.end).start, 'assignment');
        if (!forClauses.has(node)) addSemicolon(node);
        break;
      case 'ExpressionStatement':
        // A bare identifier statement is likely a macro that expands to
        // part of a statement (e.g. `#macro IF_DEBUG if DEBUG`), where
        // adding a `;` would change its meaning.
        if (
          !forClauses.has(node) &&
          node.expression.kind !== 'Identifier' &&
          node.expression.kind !== 'MemberExpression'
        ) {
          addSemicolon(node);
        }
        break;
      case 'VariableDeclaration':
        if (!forClauses.has(node)) addSemicolon(node);
        for (const declarator of node.declarators.slice(1)) {
          analysis.listItemStarts.add(declarator.start);
        }
        break;
      case 'ReturnStatement':
      case 'ThrowStatement':
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'ExitStatement':
        addSemicolon(node);
        break;
      case 'VariableDeclarator':
      case 'Parameter':
      case 'EnumMember': {
        const value =
          node.kind === 'Parameter'
            ? node.defaultValue
            : 'init' in node
              ? node.init
              : null;
        if (value) {
          analysis.operators.set(
            tokenAt(node.name.end).start,
            node.kind === 'Parameter' ? 'parameterDefault' : 'assignment',
          );
        }
        break;
      }
      case 'BinaryExpression':
        analysis.operators.set(
          tokenAt(node.left.end).start,
          comparisonOperators.has(node.operator) ? 'comparison' : 'arithmetic',
        );
        break;
      case 'UnaryExpression':
        analysis.unaryOperators.add(node.start);
        break;
      case 'UpdateExpression':
        if (node.prefix) analysis.unaryOperators.add(node.start);
        break;
      case 'StructLiteral':
        for (const property of node.properties) {
          analysis.listItemStarts.add(property.start);
          if (property.value) {
            analysis.structColons.add(tokenAt(property.key.end).start);
          }
        }
        break;
      case 'ArrayLiteral':
        for (const element of node.elements) {
          analysis.listItemStarts.add(element.start);
        }
        break;
      case 'CallExpression':
      case 'NewExpression':
        analysis.callParens.add(tokenAt(node.callee.end).start);
        for (const arg of node.args) analysis.listItemStarts.add(arg.start);
        break;
      case 'ConstructorParent':
        analysis.callParens.add(tokenAt(node.name.end).start);
        for (const arg of node.args) analysis.listItemStarts.add(arg.start);
        break;
      case 'IndexExpression':
        for (const index of node.indices) {
          analysis.listItemStarts.add(index.start);
        }
        break;
      case 'EnumDeclaration': {
        for (const member of node.members) {
          analysis.listItemStarts.add(member.start);
        }
        const brace = tokenAt(node.name.end);
        if (brace.kind === '{' && text[brace.start] === '{') {
          analysis.headerBraces.set(brace.start, node.start);
        }
        break;
      }
      case 'FunctionDeclaration':
      case 'FunctionExpression': {
        const paren = node.name
          ? tokenAt(node.name.end)
          : tokenAt(node.start + 'function'.length);
        analysis.callParens.add(paren.start);
        for (const param of node.params) {
          analysis.listItemStarts.add(param.start);
        }
        addHeaderBrace(node.body, node.start);
        break;
      }
      case 'IfStatement':
        addConditionParens(node.test);
        addHeaderBrace(node.consequent, node.start);
        if (node.alternate) {
          addHeaderBrace(node.alternate, tokenBefore(node.alternate).start);
        }
        addUnbracedBody(node.consequent);
        addUnbracedBody(node.alternate);
        break;
      case 'WhileStatement':
        addConditionParens(node.test);
        addHeaderBrace(node.body, node.start);
        addUnbracedBody(node.body);
        break;
      case 'RepeatStatement':
        addConditionParens(node.count);
        addHeaderBrace(node.body, node.start);
        addUnbracedBody(node.body);
        break;
      case 'WithStatement':
        addConditionParens(node.target);
        addHeaderBrace(node.body, node.start);
        addUnbracedBody(node.body);
        break;
      case 'DoUntilStatement':
        addSemicolon(node);
        addHeaderBrace(node.body, node.start);
        addUnbracedBody(node.body);
        break;
      case 'ForStatement':
        for (const clause of [node.init, node.update]) {
          if (clause) forClauses.add(clause);
        }
        addHeaderBrace(node.body, node.start);
        addUnbracedBody(node.body);
        break;
      case 'SwitchStatement': {
        addConditionParens(node.discriminant);
        const brace = tokenAt(node.discriminant.end);
        if (brace.kind === '{' && text[brace.start] === '{') {
          analysis.headerBraces.set(brace.start, node.start);
        }
        for (const switchCase of node.cases) {
          analysis.statementStarts.add(switchCase.start);
          const colon = tokenAt(
            switchCase.test ? switchCase.test.end : switchCase.start + 1,
          );
          if (colon.end < switchCase.end) {
            analysis.indentIntervals.push({
              start: colon.end,
              end: switchCase.end,
            });
          }
        }
        break;
      }
      case 'TryStatement':
        addHeaderBrace(node.block, node.start);
        if (node.finalizer) {
          addHeaderBrace(node.finalizer, tokenBefore(node.finalizer).start);
        }
        break;
      case 'CatchClause':
        addHeaderBrace(node.body, node.start);
        break;
    }
    return;
  });
  analysis.statements.sort((a, b) => a.start - b.start);
  analysis.indentIntervals.sort((a, b) => a.start - b.start || b.end - a.end);
  return analysis;
}

//#endregion

//#region Formatting

interface Frame {
  /** Indentation (in columns) of the line where the frame opened */
  baseCol: number;
  /** Indentation for lines inside the frame */
  innerCol: number;
  /** Offset of the opening token */
  openedAt: number;
  /** Index of the item that starts the line the frame opened on */
  lineStartItem: number;
  /**
   * Index of the item starting the line that the frame's contents are
   * indented relative to (for a block, its header's first line)
   */
  anchorLine: number;
}

class Formatter {
  protected readonly text: string;
  protected readonly parsed: ParseResult;
  protected readonly options: FormatOptions;
  /** Non-whitespace tokens: significant tokens and comments */
  protected readonly items: Token[];
  protected readonly analysis: Analysis;
  protected readonly indentUnit: 'tab' | 'space';
  /** Columns per indentation level */
  protected readonly width: number;
  protected readonly eol: string;
  /**
   * For lines whose position was preserved relative to an anchor line, the
   * anchor's indentation. The rest is alignment, rendered as spaces.
   */
  protected readonly alignedFrom = new Map<number, number>();

  constructor(parsed: ParseResult, options: FormatOptions) {
    this.parsed = parsed;
    this.text = parsed.text;
    this.options = options;
    this.items = parsed.tokens.filter(
      (t) =>
        t.kind !== 'whitespace' &&
        t.kind !== 'newline' &&
        t.kind !== 'bom' &&
        t.kind !== 'eof' &&
        t.kind !== 'macroEnd',
    );
    const significant = parsed.tokens.filter(
      (t) => !isTrivia(t.kind) && t.kind !== 'macroEnd' && t.kind !== 'eof',
    );
    this.analysis = analyze(parsed, options, significant);
    const indents = codeLineIndents(this.text, this.items);
    this.indentUnit =
      options.indentStyle === 'auto'
        ? (detectIndentation(indents) ?? options.indentFallback)
        : options.indentStyle;
    this.width =
      options.indentWidth === 'auto'
        ? (this.indentUnit === 'space' && detectIndentWidth(indents)) || 4
        : options.indentWidth;
    this.eol =
      options.endOfLine === 'auto'
        ? detectEol(this.text)
        : options.endOfLine === 'crlf'
          ? '\r\n'
          : '\n';
  }

  format(): { text: string; insertions: Map<number, string>[] } {
    const { items, text, options, analysis } = this;
    const width = this.width;
    const out: string[] = [];
    if (this.parsed.tokens[0]?.kind === 'bom') out.push('﻿');

    const frames: Frame[] = [];
    /** For each item, the index of the item starting its line */
    const lineStartOf: number[] = [];
    /** Original and new indentation columns, by line-start item index */
    const originalCol = new Map<number, number>();
    const newCol = new Map<number, number>();
    const itemIndexByStart = new Map<number, number>();
    items.forEach((item, i) => itemIndexByStart.set(item.start, i));

    // Sweeps over the sorted statements, intervals and verbatim ranges
    let statementCursor = 0;
    const openStatements: Interval[] = [];
    let intervalCursor = 0;
    const openIntervals: Interval[] = [];
    let verbatimCursor = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const previous = items[i - 1];
      const gapStart = previous ? previous.end : out.length ? 1 : 0;
      const gap = text.slice(previous ? previous.end : gapStart, item.start);

      // Advance sweeps
      while (
        statementCursor < analysis.statements.length &&
        analysis.statements[statementCursor].start <= item.start
      ) {
        openStatements.push(analysis.statements[statementCursor++]);
      }
      while (
        openStatements.length &&
        openStatements.at(-1)!.end <= item.start
      ) {
        openStatements.pop();
      }
      while (
        intervalCursor < analysis.indentIntervals.length &&
        analysis.indentIntervals[intervalCursor].start <= item.start
      ) {
        openIntervals.push(analysis.indentIntervals[intervalCursor++]);
      }
      for (let j = openIntervals.length - 1; j >= 0; j--) {
        if (openIntervals[j].end <= item.start) openIntervals.splice(j, 1);
      }
      while (
        verbatimCursor < analysis.verbatim.length &&
        analysis.verbatim[verbatimCursor].end <= item.start
      ) {
        verbatimCursor++;
      }
      const verbatim = analysis.verbatim[verbatimCursor];
      const insideVerbatim =
        !!verbatim && verbatim.start < item.start && item.start < verbatim.end;

      const prefix = analysis.prefixes.get(item.start) ?? '';
      const suffix = analysis.suffixes.get(item.start) ?? '';
      const itemText = this.itemText(item);

      if (insideVerbatim) {
        out.push(gap, prefix, itemText, suffix);
        lineStartOf[i] = /[\r\n]/.test(gap) ? i : lineStartOf[i - 1];
        continue;
      }

      // Decide whether this item starts a new line
      let newlines = countNewlines(gap);
      if (i === 0) {
        newlines = 0;
      } else if (previous.kind === '}' && item.kind === 'else') {
        if (options.elsePlacement === 'newLine')
          newlines = Math.max(newlines, 1);
        if (options.elsePlacement === 'sameLine') newlines = 0;
      } else if (
        options.openBrace === 'sameLine' &&
        analysis.headerBraces.has(item.start) &&
        !isComment(previous.kind) &&
        !isLineTrivia(previous.kind)
      ) {
        newlines = 0;
      }
      if (newlines && isLineTrivia(previous?.kind)) {
        // Directive lines (e.g. `#region`) always end their line
      } else if (!newlines && previous && isLineTrivia(previous.kind)) {
        newlines = 1;
      } else if (!newlines && previous?.kind === 'lineComment') {
        newlines = 1;
      }

      if (i === 0 || newlines) {
        if (i > 0) {
          out.push(
            this.eol.repeat(Math.min(newlines, options.maxBlankLines + 1)),
          );
        }
        lineStartOf[i] = i;
        originalCol.set(i, visualWidth(lastLine(gap), width));
        const col = this.indentFor(i, frames, openIntervals, openStatements, {
          itemIndexByStart,
          lineStartOf,
          originalCol,
          newCol,
        });
        newCol.set(i, col);
        const anchorCol = this.alignedFrom.get(i);
        if (anchorCol !== undefined && (col - anchorCol) % width !== 0) {
          // Tabs (or spaces) for indentation, spaces for alignment
          out.push(this.indentString(anchorCol), ' '.repeat(col - anchorCol));
        } else {
          out.push(this.indentString(col));
        }
      } else {
        lineStartOf[i] = lineStartOf[i - 1];
        out.push(this.spacing(previous, item, gap, prefix));
      }
      out.push(prefix, itemText, suffix);

      // Track brackets
      if (openers.has(item.kind)) {
        const owner = analysis.headerBraces.get(item.start);
        if (owner !== undefined) {
          // A block's contents are indented relative to its header's
          // line, even if the header spans several lines.
          const ownerLine = lineStartOf[itemIndexByStart.get(owner)!];
          const ownerCol = newCol.get(ownerLine)!;
          frames.push({
            baseCol: ownerCol,
            innerCol: ownerCol + width,
            openedAt: item.start,
            lineStartItem: lineStartOf[i],
            anchorLine: ownerLine,
          });
        } else {
          const lineStart = lineStartOf[i];
          const lineCol = newCol.get(lineStart)!;
          const sameLine = frames.findLast(
            (f) => f.lineStartItem === lineStart,
          );
          frames.push({
            baseCol: lineCol,
            innerCol: sameLine ? sameLine.innerCol : lineCol + width,
            openedAt: item.start,
            lineStartItem: lineStart,
            anchorLine: sameLine ? sameLine.anchorLine : lineStart,
          });
        }
      } else if (closers.has(item.kind)) {
        frames.pop();
      }
    }

    // End of file
    const lastItem = items.at(-1);
    const trailing = lastItem ? text.slice(lastItem.end) : text;
    const endsInsideComment =
      (lastItem?.kind === 'blockComment' ||
        lastItem?.kind === 'docBlockComment') &&
      !text.slice(lastItem.start, lastItem.end).endsWith('*/');
    if (endsInsideComment) {
      // An unterminated block comment runs to the end of the file, so
      // anything we add would become part of it
    } else if (options.finalNewline === 'always') {
      if (lastItem) out.push(this.eol);
    } else if (countNewlines(trailing)) {
      out.push(this.eol);
    }
    return {
      text: out.join(''),
      insertions: [analysis.prefixes, analysis.suffixes],
    };
  }

  /** An item's text, with trailing whitespace trimmed from line trivia */
  protected itemText(item: Token): string {
    const raw = this.text.slice(item.start, item.end);
    if (
      item.kind === 'lineComment' ||
      item.kind === 'docLineComment' ||
      isLineTrivia(item.kind)
    ) {
      return raw.replace(/[ \t]+$/, '');
    }
    return raw;
  }

  protected indentFor(
    i: number,
    frames: Frame[],
    openIntervals: Interval[],
    openStatements: Interval[],
    lines: {
      itemIndexByStart: Map<number, number>;
      lineStartOf: number[];
      originalCol: Map<number, number>;
      newCol: Map<number, number>;
    },
  ): number {
    const item = this.items[i];
    const width = this.width;
    const top = frames.at(-1);
    if (
      this.options.directiveIndent === 'preserve' &&
      (isLineTrivia(item.kind) || item.kind === '#macro')
    ) {
      return lines.originalCol.get(i)!;
    }
    if (closers.has(item.kind)) return top?.baseCol ?? 0;

    const owner = this.analysis.headerBraces.get(item.start);
    if (owner !== undefined) {
      const ownerItem = lines.itemIndexByStart.get(owner);
      if (ownerItem !== undefined) {
        return lines.newCol.get(lines.lineStartOf[ownerItem])!;
      }
    }

    const base = top?.innerCol ?? 0;
    // Only count extra levels that began after the innermost bracket,
    // since earlier ones are already part of that bracket's indentation.
    const extra =
      openIntervals.filter((interval) => !top || interval.start > top.openedAt)
        .length * width;
    const structural = base + extra;

    if (isComment(item.kind) && this.options.commentIndent === 'preserve') {
      if (!top) return lines.originalCol.get(i)!;
      const delta =
        lines.originalCol.get(i)! - lines.originalCol.get(top.anchorLine)!;
      return delta >= 0
        ? lines.newCol.get(top.anchorLine)! + delta
        : structural;
    }

    const isStatementLevel =
      this.analysis.statementStarts.has(item.start) ||
      statementLevelKeywords.has(item.kind) ||
      isComment(item.kind) ||
      isLineTrivia(item.kind);
    if (isStatementLevel) return structural;

    // A list item (argument, array element, ...) or a continuation line.
    // Inside a bracket opened by this statement, the bracket's indentation
    // applies. Otherwise a continuation is indented one more level.
    const statement = openStatements.at(-1);
    const insideOwnBracket =
      !!top && (!statement || top.openedAt > statement.start);
    const isListItem = this.analysis.listItemStarts.has(item.start);
    const continuation =
      isListItem || insideOwnBracket ? structural : structural + width;
    if (this.options.continuationIndent !== 'preserve') return continuation;

    // Keep the line's offset from its anchor: the line that opened the
    // innermost bracket (if opened within this statement) or else the
    // line where the statement starts.
    let anchorLine: number | undefined;
    if (insideOwnBracket) {
      anchorLine = top.lineStartItem;
    } else if (statement) {
      const statementItem = lines.itemIndexByStart.get(statement.start);
      if (statementItem !== undefined) {
        anchorLine = lines.lineStartOf[statementItem];
      }
    }
    if (anchorLine === undefined || anchorLine === i) return continuation;
    const delta =
      lines.originalCol.get(i)! - lines.originalCol.get(anchorLine)!;
    if (delta < 0) return continuation;
    const anchorCol = lines.newCol.get(anchorLine)!;
    this.alignedFrom.set(i, anchorCol);
    return anchorCol + delta;
  }

  protected indentString(col: number): string {
    if (this.indentUnit === 'space') return ' '.repeat(col);
    const width = this.width;
    return '\t'.repeat(Math.floor(col / width)) + ' '.repeat(col % width);
  }

  /** Whitespace between two items on the same line */
  protected spacing(
    previous: Token,
    next: Token,
    gap: string,
    nextPrefix: string,
  ): string {
    const { options, analysis } = this;
    const nextKind: TokenKind = nextPrefix ? '(' : next.kind;
    const previousSuffix = analysis.suffixes.get(previous.start) ?? '';
    // When a line break is being removed, the gap collapses to a space
    const preserved = /[\r\n]/.test(gap) ? ' ' : gap;
    const spaced = () =>
      options.keepAlignment && /^[ \t]+$/.test(gap) ? gap : ' ';

    if (isComment(next.kind)) return preserved || ' ';
    if (isComment(previous.kind)) return preserved;

    if (nextKind === ';') return '';
    if (nextKind === ',') return '';
    if (previous.kind === ',') {
      return options.commaSpace === 'space' ? spaced() : preserved;
    }
    if (previous.kind === '.' || next.kind === '.') return '';

    if (conditionKeywords.has(previous.kind) && nextKind === '(') {
      if (options.keywordParenSpace === 'space') return ' ';
      if (options.keywordParenSpace === 'none') return '';
      return preserved;
    }
    if (analysis.callParens.has(next.start) && !nextPrefix) {
      return options.functionParenSpace === 'none' ? '' : preserved;
    }
    if (analysis.headerBraces.has(next.start)) return ' ';
    if (previousSuffix) {
      // After an inserted `;` or `)`: keep as written
      return preserved;
    }

    if (analysis.structColons.has(next.start)) {
      if (options.structColon === 'spaced') return spaced();
      if (options.structColon === 'after') return '';
      return preserved;
    }
    if (analysis.structColons.has(previous.start)) {
      return options.structColon === 'preserve' ? preserved : spaced();
    }

    const operatorClass =
      analysis.operators.get(next.start) ??
      analysis.operators.get(previous.start);
    if (operatorClass) {
      const setting =
        operatorClass === 'assignment'
          ? options.assignmentSpacing
          : operatorClass === 'parameterDefault'
            ? options.parameterDefaultSpacing
            : operatorClass === 'comparison'
              ? options.comparisonSpacing
              : options.arithmeticSpacing;
      if (setting === 'tight') return '';
      return setting === 'spaced' ? spaced() : preserved;
    }

    if (analysis.unaryOperators.has(previous.start)) {
      // Keyword operators need a space, and some sequences would
      // otherwise merge into a different token (`- -a` vs `--a`)
      const operatorText = this.text.slice(previous.start, previous.end);
      if (/\w$/.test(operatorText)) return ' ';
      const nextText = this.text.slice(next.start, next.end);
      if (/^[-+]/.test(nextText) && /[-+]$/.test(operatorText)) return ' ';
      if (/^[!~]/.test(operatorText) && /^[!~]/.test(nextText)) return '';
      return '';
    }
    return preserved;
  }
}

//#endregion

//#region Helpers

function isLineTrivia(kind: TokenKind | undefined): boolean {
  return kind === 'region' || kind === 'endregion' || kind === 'directive';
}

function countNewlines(text: string): number {
  return text.match(/\r\n|\r|\n/g)?.length ?? 0;
}

function lastLine(text: string): string {
  const match = /[^\r\n]*$/.exec(text);
  return match ? match[0] : text;
}

function visualWidth(whitespace: string, tabWidth: number): number {
  let col = 0;
  for (const c of whitespace) {
    col = c === '\t' ? (Math.floor(col / tabWidth) + 1) * tabWidth : col + 1;
  }
  return col;
}

/**
 * The leading whitespace of each line that starts with code (so not lines
 * inside block comments or multi-line strings).
 */
function codeLineIndents(text: string, items: Token[]): string[] {
  const indents: string[] = [];
  for (let i = 1; i < items.length; i++) {
    if (isComment(items[i].kind)) continue;
    const gap = text.slice(items[i - 1].end, items[i].start);
    if (/[\r\n]/.test(gap)) {
      const indent = lastLine(gap);
      if (indent) indents.push(indent);
    }
  }
  return indents;
}

/** Whether indented lines mostly start with tabs or spaces */
function detectIndentation(indents: string[]): 'tab' | 'space' | undefined {
  let tabs = 0;
  let spaces = 0;
  for (const indent of indents) {
    if (indent[0] === '\t') tabs++;
    else if (indent.length >= 2) spaces++;
  }
  if (tabs === spaces) return undefined;
  return tabs > spaces ? 'tab' : 'space';
}

/**
 * For space-indented files: 2 if indentation is mostly in steps of 2
 * (rather than 4), else 4.
 */
function detectIndentWidth(indents: string[]): number | undefined {
  let multiplesOf4 = 0;
  let total = 0;
  for (const indent of indents) {
    if (!/^ +$/.test(indent)) continue;
    total++;
    if (indent.length % 4 === 0) multiplesOf4++;
  }
  if (!total) return undefined;
  return multiplesOf4 / total >= 0.75 ? 4 : 2;
}

function detectEol(text: string): '\n' | '\r\n' {
  const crlf = text.match(/\r\n/g)?.length ?? 0;
  const lf = (text.match(/\n/g)?.length ?? 0) - crlf;
  return crlf > lf ? '\r\n' : '\n';
}

/**
 * Check that the output has the same tokens as the input, apart from
 * planned insertions. Comments must be unchanged (apart from trailing
 * whitespace). Throws if not, so we never return damaged code.
 */
function verify(
  parsed: ParseResult,
  output: string,
  [prefixes, suffixes]: Map<number, string>[],
) {
  const expected: string[] = [];
  for (const token of parsed.tokens) {
    if (
      token.kind === 'whitespace' ||
      token.kind === 'newline' ||
      token.kind === 'eof' ||
      token.kind === 'macroEnd' ||
      token.kind === 'lineContinuation'
    ) {
      continue;
    }
    for (const part of splitInsertion(prefixes.get(token.start))) {
      expected.push(part);
    }
    expected.push(parsed.text.slice(token.start, token.end).trimEnd());
    for (const part of splitInsertion(suffixes.get(token.start))) {
      expected.push(part);
    }
  }
  const actual = lex(output)
    .tokens.filter(
      (t) =>
        t.kind !== 'whitespace' &&
        t.kind !== 'newline' &&
        t.kind !== 'eof' &&
        t.kind !== 'macroEnd' &&
        t.kind !== 'lineContinuation',
    )
    .map((t) => output.slice(t.start, t.end).trimEnd());
  const length = Math.max(expected.length, actual.length);
  for (let i = 0; i < length; i++) {
    if (expected[i] !== actual[i]) {
      throw new GmlFormatError(
        `Formatter bug: output token ${i} is ${JSON.stringify(actual[i])}, expected ${JSON.stringify(expected[i])}. The source was not changed.`,
      );
    }
  }
}

function splitInsertion(insertion: string | undefined): string[] {
  return insertion ? [...insertion] : [];
}

//#endregion
