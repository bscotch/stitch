/**
 * Compare this package's analysis of `samples/project` against the
 * golden feature snapshot recorded from the old `@bscotch/gml-parser`.
 *
 * Symbol ids differ between the two engines, so references are compared by
 * what they point to: `native:<name>`, the declaration's `file:line:col`,
 * or `undeclared:<name>`.
 *
 * Printed by `node scripts/compare-snapshot.ts [--verbose]`, and checked by
 * `snapshot.test.ts`.
 */
import { GameMakerProject } from '@bscotch/gamemaker-project';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fileDiagnostics } from './diagnostics.ts';
import { analyzeProject } from './project.ts';
import { GmlQueries } from './queries.ts';

const projectDir = new URL('../../parser/samples/project', import.meta.url);
const snapshotFile = new URL(
  '../../parser/snapshots/project.json',
  import.meta.url,
);

interface OldSnapshot {
  files: Record<
    string,
    {
      refs: { at: string; text: string; symbol: string; isDef: boolean }[];
      diagnostics: {
        at: string;
        severity: string;
        kind: string;
        message: string;
      }[];
      signatures: {
        at: string;
        idx: number;
        param: string | null;
        fn: string;
      }[];
      completions: { at: string; names: string[] }[];
    }
  >;
  symbols: Record<
    string,
    { def: string | null; type: string; flags: string[] }
  >;
}

export async function compareWithOldSnapshot(verbose = false) {
  const old: OldSnapshot = JSON.parse(await fs.readFile(snapshotFile, 'utf8'));
  const project = await GameMakerProject.open(fileURLToPath(projectDir));
  const analyzer = await analyzeProject(project);
  const queries = new GmlQueries(analyzer);

  const kindFor: Record<string, string> = {
    syntax: 'SYNTAX_ERROR',
    jsdoc: 'JSDOC',
    'jsdoc-mismatch': 'JSDOC_MISMATCH',
    'global-self': 'GLOBAL_SELF',
    'invalid-operation': 'INVALID_OPERATION',
    'shadowed-native': 'INVALID_OPERATION',
    'undeclared-global': 'UNDECLARED_GLOBAL_REFERENCE',
    'undeclared-variable': 'UNDECLARED_VARIABLE_REFERENCE',
    'missing-argument': 'MISSING_REQUIRED_ARGUMENT',
    'too-many-arguments': 'TOO_MANY_ARGUMENTS',
    'unused-function': 'UNUSED',
  };

  /** `file:line:col` (1-based) of the start of an old-style location string */
  const oldDefStart = (def: string | null) => def?.replace(/-.*$/, '') ?? null;
  const oldTarget = (symbol: string, text: string) => {
    if (symbol.startsWith('native:')) return `native:${text}`;
    const entry = old.symbols[symbol] ?? old.symbols[`${symbol}#2`];
    const def = oldDefStart(entry?.def ?? null);
    return def ? def : `undeclared:${text}`;
  };

  const counts = {
    same: 0,
    differentTarget: 0,
    onlyOld: 0,
    onlyNew: 0,
    defFlag: 0,
  };
  const report: string[] = [];
  const diagReport: string[] = [];
  const sigReport: string[] = [];
  const completionReport: string[] = [];

  for (const fileId of analyzer.fileIds.sort()) {
    const parsed = analyzer.getFile(fileId)!;
    const analysis = analyzer.getAnalysis(fileId)!;
    const lines = parsed.lines;
    const at = (start: number, end: number) => {
      const s = lines.positionAt(start);
      const e = lines.positionAt(Math.max(start, end - 1));
      return `${s.line + 1}:${s.character + 1}-${e.line + 1}:${e.character + 1}`;
    };
    const newTarget = (symbolId: string, text: string, implicit?: boolean) => {
      const symbol = analyzer.table.getSymbol(symbolId);
      if (symbol?.native) return `native:${symbol.name}`;
      if (implicit || !symbol?.def) return `undeclared:${text}`;
      const d = analyzer
        .getFile(symbol.def.file)!
        .lines.positionAt(symbol.def.start);
      return `${symbol.def.file}:${d.line + 1}:${d.character + 1}`;
    };

    const oldFile = old.files[fileId];
    if (!oldFile) {
      report.push(`${fileId}: not in old snapshot`);
      continue;
    }
    // References
    const oldRefs = new Map(oldFile.refs.map((r) => [r.at, r]));
    const seen = new Set<string>();
    for (const ref of analysis.refs) {
      const key = at(ref.start, ref.end);
      const text = parsed.text.slice(ref.start, ref.end);
      const target = newTarget(ref.symbol, text, ref.implicit);
      const o = oldRefs.get(key);
      seen.add(key);
      if (!o) {
        counts.onlyNew++;
        report.push(`${fileId}:${key} only new: ${text} → ${target}`);
        continue;
      }
      const ot = oldTarget(o.symbol, o.text);
      if (ot !== target) {
        counts.differentTarget++;
        report.push(`${fileId}:${key} ${text}: old → ${ot}, new → ${target}`);
      } else counts.same++;
      if (o.isDef !== queries.isDeclaration(fileId, ref)) {
        counts.defFlag++;
        if (verbose)
          report.push(`${fileId}:${key} ${text}: isDef old=${o.isDef}`);
      }
    }
    for (const [key, o] of oldRefs) {
      if (seen.has(key)) continue;
      counts.onlyOld++;
      report.push(
        `${fileId}:${key} only old: ${o.text} → ${oldTarget(o.symbol, o.text)}`,
      );
    }

    // Diagnostics
    const newDiags = fileDiagnostics(analyzer, fileId).map(
      (d) => `${at(d.start, d.end)} ${kindFor[d.code] ?? d.code}: ${d.message}`,
    );
    const oldDiags = oldFile.diagnostics.map(
      (d) => `${d.at} ${d.kind}: ${d.message}`,
    );
    for (const d of oldDiags)
      if (!newDiags.includes(d)) diagReport.push(`${fileId} only old: ${d}`);
    for (const d of newDiags)
      if (!oldDiags.includes(d)) diagReport.push(`${fileId} only new: ${d}`);

    // Signatures
    // Old argument ranges end at the next delimiter (inclusive)
    const atArgs = (start: number, end: number) => at(start, end + 1);
    const newSigs = analysis.argumentRanges.map(
      (r) =>
        `${atArgs(r.start, r.end)} #${r.idx} ${queries.parameterFor(r)?.name ?? null}`,
    );
    const oldSigs = oldFile.signatures.map(
      (s) => `${s.at} #${s.idx} ${s.param}`,
    );
    for (const s of oldSigs)
      if (!newSigs.includes(s)) sigReport.push(`${fileId} only old: ${s}`);
    for (const s of newSigs)
      if (!oldSigs.includes(s)) sigReport.push(`${fileId} only new: ${s}`);

    // Completions (non-native, non-global names in scope)
    for (const c of oldFile.completions) {
      const [line, col] = c.at.split('-')[0].split(':').map(Number);
      const offset = lines.offsetAt({ line: line - 1, character: col - 1 });
      const names = queries
        .symbolsInScopeAt(fileId, offset)
        .filter((s) => !s.native && !s.global)
        .map((s) => s.name)
        .sort();
      const missing = c.names.filter((n) => !names.includes(n));
      const extra = names.filter((n) => !c.names.includes(n));
      if (missing.length || extra.length) {
        completionReport.push(
          `${fileId}:${c.at} missing [${missing.join(', ')}] extra [${extra.join(', ')}]`,
        );
      }
    }
  }

  return { counts, report, diagReport, sigReport, completionReport };
}
