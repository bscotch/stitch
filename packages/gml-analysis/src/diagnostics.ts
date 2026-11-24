/**
 * Diagnostics for a file: those found while checking it, plus those that
 * depend on the whole project (undeclared variables, argument counts,
 * unused functions), plus purely syntactic style checks.
 */
import { binaryPrecedence, walk, type Node } from '@bscotch/gml-syntax';
import type { GmlAnalyzer } from './analyzer.ts';
import type { Diagnostic, DiagnosticSeverity } from './analysis.types.ts';
import { ids } from './symbols.ts';

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

  // Unused global functions declared in this file
  for (const symbol of table.listMembers(ids.globalShape)) {
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

  return diagnostics.sort((a, b) => a.start - b.start || a.end - b.end);
}

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
