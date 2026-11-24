/**
 * Diagnostics for a file: those found while checking it, plus those that
 * depend on the whole project (undeclared variables, argument counts,
 * unused functions), plus purely syntactic style checks.
 */
import { binaryPrecedence, walk, type Node } from '@bscotch/gml-syntax';
import type { GmlAnalyzer } from './analyzer.ts';
import type {
  Diagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
} from './analysis.types.ts';
import { ids } from './symbols.ts';
import { formatUnion, type Type, type TypeUnion } from './types.ts';

export interface DiagnosticOptions {
  /**
   * Flag expressions that mix operators of different precedence without
   * parentheses (e.g. `a || b && c`). GameMaker's operator precedence can
   * vary by platform. @default 'off'
   */
  mixedOperators?: DiagnosticSeverity | 'off';
  /**
   * Flag calls where more than one argument calls a function or has side
   * effects. GameMaker's argument evaluation order can vary by platform.
   * @default 'off'
   */
  argumentEvaluationOrder?: DiagnosticSeverity | 'off';
  /** Undeclared variables with these prefixes are assumed to exist */
  autoDeclareGlobalsPrefixes?: string[];
  /**
   * Flag global functions, constructors, enums, macros and global variables
   * that have no doc comment. @default 'off'
   */
  missingDocs?: DiagnosticSeverity | 'off';
  /**
   * Flag arguments whose type clearly doesn't match the parameter's (e.g. a
   * string where a number is expected). @default 'warning'
   */
  argumentTypes?: DiagnosticSeverity | 'off';
}

export function fileDiagnostics(
  analyzer: GmlAnalyzer,
  fileId: string,
  options: DiagnosticOptions = {},
): Diagnostic[] {
  const analysis = analyzer.getAnalysis(fileId);
  const parsed = analyzer.getFile(fileId);
  if (!analysis || !parsed) return [];
  const table = analyzer.table;
  const diagnostics: Diagnostic[] = [...analysis.diagnostics];

  // Doc comment problems
  for (const doc of parsed.docs.all) {
    for (const d of doc.diagnostics) {
      diagnostics.push({
        code: 'jsdoc',
        severity: 'warning',
        message: d.message,
        start: d.start,
        end: d.end,
      });
    }
  }

  // Undeclared variables (once per name)
  const prefixes =
    options.autoDeclareGlobalsPrefixes ??
    analyzer.options.autoDeclareGlobalsPrefixes ??
    [];
  const reported = new Set<string>();
  for (const ref of analysis.refs) {
    if (!ref.implicit || reported.has(ref.symbol)) continue;
    // Undeclared globals were already reported by the checker
    if (ref.symbol.startsWith(`${ids.globalShape}/`)) continue;
    if (table.getSymbol(ref.symbol)) continue;
    const name = ref.symbol.slice(ref.symbol.lastIndexOf('/') + 1);
    if (prefixes.some((p) => name.startsWith(p))) continue;
    // On an instance of unknown type (e.g. a script function's caller), the
    // name is fine as long as some object or struct declares it
    if (
      ref.symbol.startsWith(`${ids.instanceBase}/`) &&
      (ref.write || analyzer.declaredMemberNames.has(name))
    ) {
      continue;
    }
    reported.add(ref.symbol);
    diagnostics.push({
      code: 'undeclared-variable',
      severity: 'warning',
      message: `Undeclared symbol \`${name}\``,
      start: ref.start,
      end: ref.end,
    });
  }

  // Argument counts
  calls: for (const call of analysis.calls) {
    const fn = table.getFunction(call.fn);
    if (!fn) continue;
    const params = fn.params.map((p) => table.getSymbol(p));
    const name = fn.name ?? 'function';
    for (const [i, param] of params.entries()) {
      const arg = call.args[i];
      // An omitted argument (`f(a,,c)`) deliberately passes `undefined`
      if (param && !param.optional && i >= call.argCount) {
        const at = arg ?? call.args[0];
        diagnostics.push({
          code: 'missing-argument',
          severity: 'error',
          message: `Missing required argument \`${param.name}\` for function \`${name}\`.`,
          start: at.start,
          end: at.end,
        });
        continue calls;
      }
    }
    if (fn.variadic || params.at(-1)?.name === '...') continue;
    if (!params.length && call.args.length === 1 && !call.args[0].hasExpression)
      continue;
    // (A trailing comma, as in `f(a, b,)`, isn't an extra argument)
    for (const arg of call.args.slice(params.length, call.argCount)) {
      diagnostics.push({
        code: 'too-many-arguments',
        severity: 'warning',
        message: `Extra argument for function \`${name}\`.`,
        start: arg.start,
        end: arg.end,
      });
    }
  }

  // Argument types
  const argumentTypes = options.argumentTypes ?? 'warning';
  if (argumentTypes !== 'off') {
    for (const call of analysis.calls) {
      const fn = table.getFunction(call.fn);
      if (!fn || fn.templates?.length) continue;
      for (const arg of call.args) {
        const param = table.getSymbol(fn.params[arg.idx]);
        if (!param || !arg.types?.length || !arg.hasExpression) continue;
        if (isAssignable(arg.types, param.type)) continue;
        diagnostics.push({
          code: 'argument-type',
          severity: argumentTypes,
          message: `\`${param.name}\` expects \`${formatUnion(param.type)}\`, but this is \`${formatUnion(arg.types)}\`.`,
          start: arg.start,
          end: arg.end,
        });
      }
    }
  }

  // Missing docs on global declarations in this file
  const missingDocs = options.missingDocs ?? 'off';
  if (missingDocs !== 'off') {
    for (const symbol of analyzer.globalsDeclaredIn(fileId)) {
      if (symbol.native || symbol.def?.file !== fileId || symbol.description)
        continue;
      if (
        !['function', 'constructor', 'enum', 'macro', 'variable'].includes(
          symbol.kind,
        )
      )
        continue;
      diagnostics.push({
        code: 'missing-docs',
        severity: missingDocs,
        message: `\`${symbol.name}\` has no documentation.`,
        start: symbol.def.start,
        end: symbol.def.end,
      });
    }
  }

  // Unused global functions declared in this file
  for (const symbol of analyzer.globalsDeclaredIn(fileId)) {
    if (symbol.native || symbol.def?.file !== fileId) continue;
    if (symbol.kind !== 'function' && symbol.kind !== 'constructor') continue;
    const refs = analyzer.refIndex.get(symbol.id) ?? [];
    const used = refs.some(
      (r) => r.file !== fileId || r.start !== symbol.def!.start,
    );
    if (!used) {
      diagnostics.push({
        code: 'unused-function',
        severity: 'info',
        message: `Unused function \`${symbol.name}\``,
        start: symbol.def.start,
        end: symbol.def.end,
      });
    }
  }

  // Style checks for platform-dependent behavior
  const mixed = options.mixedOperators ?? 'off';
  const order = options.argumentEvaluationOrder ?? 'off';
  if (mixed !== 'off' || order !== 'off') {
    walk(parsed.parsed.ast, (node) => {
      if (mixed !== 'off' && node.kind === 'BinaryExpression') {
        const precedence = binaryPrecedence.get(node.operator);
        for (const side of [node.left, node.right]) {
          if (side.kind !== 'BinaryExpression') continue;
          if (binaryPrecedence.get(side.operator) === precedence) continue;
          diagnostics.push({
            code: 'mixed-operators',
            severity: mixed,
            message: `Use parentheses to group \`${side.operator}\` when mixed with \`${node.operator}\`: operator precedence can vary by platform.`,
            start: side.start,
            end: side.end,
          });
        }
      }
      if (
        order !== 'off' &&
        (node.kind === 'CallExpression' || node.kind === 'NewExpression')
      ) {
        const effectful = node.args.filter((a) => hasSideEffects(a));
        if (effectful.length > 1) {
          diagnostics.push({
            code: 'argument-evaluation-order',
            severity: order,
            message:
              'More than one argument calls a function or has side effects, and argument evaluation order can vary by platform. Consider computing them first.',
            start: effectful[0].start,
            end: effectful.at(-1)!.end,
          });
        }
      }
    });
  }

  return suppress(analyzer, fileId, diagnostics).sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
}

/**
 * Remove diagnostics suppressed by comments:
 * - `// @stitch-ignore-next-line` or `// @stitch-ignore-next-line: code, code`
 * - `// @stitch-ignore` (or with codes) at the end of the line it applies to
 */
function suppress(
  analyzer: GmlAnalyzer,
  fileId: string,
  diagnostics: Diagnostic[],
): Diagnostic[] {
  const parsed = analyzer.getFile(fileId)!;
  /** Line → suppressed codes (empty: all) */
  const ignored = new Map<number, Set<string>>();
  const pattern =
    /@stitch-ignore(-next-line)?\b\s*:?\s*([\w-]+(?:\s*,\s*[\w-]+)*)?/;
  for (const token of parsed.parsed.tokens) {
    if (token.kind !== 'lineComment' && token.kind !== 'blockComment') continue;
    const match = parsed.text.slice(token.start, token.end).match(pattern);
    if (!match) continue;
    const line = parsed.lines.positionAt(token.start).line + (match[1] ? 1 : 0);
    const codes = new Set(match[2]?.split(/\s*,\s*/) ?? []);
    const existing = ignored.get(line);
    ignored.set(
      line,
      existing && !existing.size
        ? existing
        : new Set([...(existing ?? []), ...codes]),
    );
    if (!match[2]) ignored.set(line, new Set());
  }
  if (!ignored.size) return diagnostics;
  return diagnostics.filter((d) => {
    const codes = ignored.get(parsed.lines.positionAt(d.start).line);
    return !codes || (codes.size > 0 && !codes.has(d.code));
  });
}

/**
 * Whether values of one type can (plausibly) be passed where another is
 * expected. Deliberately permissive: only clear mismatches fail, like a
 * string where a number is expected.
 */
export function isAssignable(from: TypeUnion, to: TypeUnion): boolean {
  if (!to.length || !from.length) return true;
  // A variable's type includes everything ever assigned to it, so it's fine
  // if any of its possible types fits
  return from.some((f) => to.some((t) => accepts(t, f)));
}

const numberLike = new Set(['Real', 'Bool', 'Enum', 'EnumMember', 'Pointer']);

function accepts(to: Type, from: Type): boolean {
  const loose = [
    'Any',
    'Mixed',
    'Unknown',
    'Undefined',
    'Never',
    'ArgumentIdentity',
  ];
  if (to.generic || from.generic) return true;
  if (loose.includes(to.kind) || loose.includes(from.kind)) return true;
  if (to.kind === from.kind) return true;
  const family = (kind: string) => kind.split('.')[0];
  // Numbers, booleans, enums, constants, and handles (assets and ids are
  // numbers in older code) are interchangeable
  const numeric = (t: Type) =>
    numberLike.has(t.kind) ||
    !!t.constant ||
    family(t.kind) === 'Asset' ||
    family(t.kind) === 'Id';
  if (numeric(to) && numeric(from)) return true;
  // Instances and structs can both be used as scopes
  const scope = (t: Type) =>
    t.kind === 'Struct' ||
    t.kind === 'Id.Instance' ||
    t.kind === 'Asset.GMObject';
  if (scope(to) && scope(from)) return true;
  // Functions are also methods (structs)
  if (
    (to.kind === 'Struct' && from.kind === 'Function') ||
    (to.kind === 'Function' && from.kind === 'Struct')
  )
    return true;
  return false;
}

export type { DiagnosticCode };

/** Whether evaluating a node could call code or change state */
function hasSideEffects(node: Node): boolean {
  let found = false;
  walk(node, (n) => {
    if (found) return false;
    if (n.kind === 'FunctionExpression') return false; // Defining isn't calling
    if (
      n.kind === 'CallExpression' ||
      n.kind === 'NewExpression' ||
      n.kind === 'UpdateExpression' ||
      n.kind === 'Assignment'
    ) {
      found = true;
      return false;
    }
    return undefined;
  });
  return found;
}
