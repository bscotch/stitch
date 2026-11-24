import { GmlAnalyzer, type AssetInfo } from './analyzer.ts';
import type { SourceFile } from './file.ts';
import { NativeTable } from './natives.ts';
import { GmlQueries } from './queries.ts';
import { fallbackGmlSpecPath, readGmlSpec } from './spec.ts';
import { formatUnion } from './types.ts';

let natives: NativeTable | undefined;
export async function getNatives(): Promise<NativeTable> {
  natives ||= new NativeTable([await readGmlSpec(fallbackGmlSpecPath)]);
  return natives;
}

/** A test file: `scripts/Foo` for script Foo, `objects/o_x/Step_0` for an event */
export type TestFiles = Record<string, string>;

export function sourceFileFor(id: string): SourceFile {
  const [kind, asset, event] = id.split('/');
  if (kind === 'scripts') return { id, kind: 'script', asset };
  if (kind === 'objects') return { id, kind: 'objectEvent', asset, event };
  if (kind === 'rooms') return { id, kind: 'roomCreation', asset };
  throw new Error(`Unknown file kind: ${id}`);
}

export interface TestProject {
  analyzer: GmlAnalyzer;
  queries: GmlQueries;
  /** The offset of the `n`th occurrence of `needle` in a file (0-based n) */
  at(file: string, needle: string, n?: number): number;
  /** The symbol referenced at the `n`th occurrence of `needle` */
  symbolAt(
    file: string,
    needle: string,
    n?: number,
  ): ReturnType<GmlQueries['symbolOf']>;
  /** The formatted type of the symbol at the `n`th occurrence of `needle` */
  typeAt(file: string, needle: string, n?: number): string | undefined;
  /** Where the symbol at `needle` is declared, as `file@name:offset` */
  defAt(file: string, needle: string, n?: number): string | undefined;
  /** The same format as `defAt`, for the identifier at the start of `needle` */
  declaration(file: string, needle: string, n?: number): string;
  update(file: string, text: string): ReturnType<GmlAnalyzer['analyze']>;
}

export async function analyzeFiles(
  files: TestFiles,
  options: { assets?: AssetInfo[]; autoDeclareGlobalsPrefixes?: string[] } = {},
): Promise<TestProject> {
  const analyzer = new GmlAnalyzer(await getNatives(), options);
  const assets = new Map<string, AssetInfo>();
  for (const id of Object.keys(files)) {
    const [kind, name] = id.split('/');
    assets.set(name, { name, kind });
  }
  for (const asset of options.assets ?? []) assets.set(asset.name, asset);
  analyzer.setProject({ assets: [...assets.values()] });
  for (const [id, text] of Object.entries(files)) {
    analyzer.setFile(sourceFileFor(id), text);
  }
  analyzer.analyze();
  const queries = new GmlQueries(analyzer);
  const at = (file: string, needle: string, n = 0) => {
    const text = analyzer.getFile(file)!.text;
    let offset = -1;
    for (let i = 0; i <= n; i++) {
      offset = text.indexOf(needle, offset + 1);
      if (offset < 0) throw new Error(`"${needle}" #${n} not found in ${file}`);
    }
    return offset;
  };
  /** The symbol at the last identifier in `needle` (e.g. `c` in `var c`, `f` in `f(1`) */
  const symbolAt = (file: string, needle: string, n = 0) => {
    const words = [...needle.matchAll(/[A-Za-z_]\w*/g)];
    const last = words.at(-1)!;
    const offset =
      at(file, needle, n) + last.index! + Math.floor(last[0].length / 2);
    return queries.symbolOf(queries.referenceAt(file, offset));
  };
  return {
    analyzer,
    queries,
    at,
    symbolAt,
    typeAt: (file, needle, n) => {
      const symbol = symbolAt(file, needle, n);
      return symbol && formatUnion(symbol.type);
    },
    defAt: (file, needle, n) => {
      const def = symbolAt(file, needle, n)?.def;
      if (!def) return undefined;
      return `${def.file}@${analyzer.getFile(def.file)!.text.slice(def.start, def.end)}:${def.start}`;
    },
    declaration: (file, needle, n) => {
      const start = at(file, needle, n);
      const name = needle.match(/^\w+/)![0];
      return `${file}@${name}:${start}`;
    },
    update: (file, text) => {
      analyzer.setFile(sourceFileFor(file), text);
      return analyzer.analyze();
    },
  };
}
