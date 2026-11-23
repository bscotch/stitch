/**
 * Golden "feature snapshot" of everything editor features depend on
 * (refs, definitions, hovers, completions, signatures, diagnostics).
 *
 * Used as a regression baseline during the parser overhaul: any new
 * engine must produce the same snapshot, or the differences must be
 * reviewed and accepted as intended fixes.
 */
import type { Code } from './project.code.ts';
import type { Range } from './project.location.ts';
import type { Project } from './project.ts';
import type { Signifier } from './signifiers.ts';

export interface FeatureSnapshot {
  files: Record<string, FileSnapshot>;
  /** Project-defined (non-native) symbols, keyed by `parent/name` */
  symbols: Record<string, SymbolSnapshot>;
}

interface FileSnapshot {
  refs: {
    at: string;
    text: string;
    symbol: string;
    isDef: boolean;
  }[];
  diagnostics: { at: string; severity: string; kind: string; message: string }[];
  signatures: { at: string; idx: number; param: string | null; fn: string }[];
  /** Non-global in-scope symbol names at sampled positions */
  completions: { at: string; names: string[] }[];
}

interface SymbolSnapshot {
  def: string | null;
  type: string;
  description: string | null;
  flags: string[];
  refs: string[];
}

const flagNames = [
  'global',
  'local',
  'instance',
  'parameter',
  'macro',
  'enum',
  'enumMember',
  'static',
  'writable',
  'deprecated',
] as const;

/** Sample every Nth ref position for completions, to keep snapshots small */
const COMPLETION_SAMPLE_RATE = 7;

export function snapshotProject(project: Project): FeatureSnapshot {
  const root = project.dir.absolute.replace(/\\/g, '/');
  const rel = (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    return normalized.startsWith(root)
      ? normalized.slice(root.length + 1)
      : normalized;
  };
  const loc = (range: Range | { file?: undefined } | undefined) => {
    if (!range || !range.file) return null;
    const r = range as Range;
    return `${rel(r.file.path.absolute)}:${r.start.line}:${r.start.column}-${r.end.line}:${r.end.column}`;
  };
  const shortLoc = (range: Range) =>
    `${range.start.line}:${range.start.column}-${range.end.line}:${range.end.column}`;
  const symbolId = (s: Signifier) => {
    const p = s.parent;
    const parent = p
      ? p.name
        ? `${p.kind}.${p.name}`
        : p.signifier?.name
          ? `${p.kind}(${p.signifier.name})`
          : p.kind
      : '?';
    // Anonymous scopes (locals, etc) are disambiguated by definition site
    const anonymous = !p?.name && !p?.signifier?.name;
    const at = anonymous && s.def?.file ? `@${loc(s.def)}` : '';
    return `${s.native ? 'native:' : ''}${parent}/${s.name}${at}`;
  };

  const snapshot: FeatureSnapshot = { files: {}, symbols: {} };
  const seenSymbols = new Set<Signifier>();

  const files: Code[] = [];
  for (const asset of project.assets.values()) {
    files.push(...asset.gmlFilesArray);
  }
  files.sort((a, b) =>
    rel(a.path.absolute).localeCompare(rel(b.path.absolute)),
  );

  for (const file of files) {
    const fileSnap: FileSnapshot = {
      refs: [],
      diagnostics: [],
      signatures: [],
      completions: [],
    };
    const refs = file.refs;
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      fileSnap.refs.push({
        at: shortLoc(ref),
        text: ref.text,
        symbol: symbolId(ref.item),
        isDef: !!ref.isDef,
      });
      if (!ref.item.native) seenSymbols.add(ref.item);
      if (i % COMPLETION_SAMPLE_RATE === 0) {
        const names = file
          .getInScopeSymbolsAt(ref.start)
          .filter((s) => !s.native && !s.global)
          .map((s) => s.name)
          .sort();
        fileSnap.completions.push({ at: shortLoc(ref), names });
      }
    }
    for (const [kind, diagnostics] of Object.entries(file.getDiagnostics())) {
      for (const d of diagnostics) {
        const at = d.location as Range;
        fileSnap.diagnostics.push({
          at: at?.start ? shortLoc(at) : '?',
          severity: d.severity,
          kind,
          message: d.message,
        });
      }
    }
    fileSnap.diagnostics.sort((a, b) =>
      `${a.at}${a.kind}${a.message}`.localeCompare(
        `${b.at}${b.kind}${b.message}`,
      ),
    );
    for (const argRange of file.functionArgRanges) {
      let param: string | null = null;
      try {
        param = argRange.param?.name ?? null;
      } catch {
        param = null;
      }
      fileSnap.signatures.push({
        at: shortLoc(argRange),
        idx: argRange.idx,
        param,
        fn: argRange.type?.toFeatherString() ?? '?',
      });
    }
    snapshot.files[rel(file.path.absolute)] = fileSnap;
  }

  for (const s of project.self.listMembers()) {
    if (!s.native) seenSymbols.add(s);
  }
  const symbolEntries = [...seenSymbols].map(
    (s) =>
      [
        symbolId(s),
        {
          def: loc(s.def),
          type: s.type.toFeatherString(),
          description: s.description ?? null,
          flags: flagNames.filter((f) => (s as any)[f]),
          refs: [...s.refs].map((r) => loc(r)!).sort(),
        },
      ] as const,
  );
  symbolEntries.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [id, sym] of symbolEntries) {
    // Distinct signifiers can share an id (e.g. same-named locals in
    // different functions), so disambiguate deterministically.
    let key = id;
    for (let n = 2; key in snapshot.symbols; n++) key = `${id}#${n}`;
    snapshot.symbols[key] = sym;
  }
  return snapshot;
}
