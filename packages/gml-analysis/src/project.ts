/**
 * Analyzing a `@bscotch/gamemaker-project` project.
 */
import type {
  AssetDependency,
  GameMakerProject,
} from '@bscotch/gamemaker-project';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  GmlAnalyzer,
  type AnalyzerOptions,
  type ExtensionInfo,
  type ProjectInfo,
} from './analyzer.ts';
import type { SourceFile } from './file.ts';
import { ids } from './symbols.ts';
import { NativeTable } from './natives.ts';
import { fallbackGmlSpecPath, readGmlSpec, type GmlSpec } from './spec.ts';

async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

/** Describe a project's GML files for the analyzer */
export function listSourceFiles(project: GameMakerProject): SourceFile[] {
  const files: SourceFile[] = [];
  const rel = (file: string) =>
    path.relative(project.dir, file).split(path.sep).join('/');
  for (const asset of project.assets) {
    if (asset.isKind('scripts')) {
      for (const file of asset.gmlFiles) {
        files.push({ id: rel(file), kind: 'script', asset: asset.name });
      }
    } else if (asset.isKind('objects')) {
      for (const file of asset.gmlFiles) {
        files.push({
          id: rel(file),
          kind: 'objectEvent',
          asset: asset.name,
          event: path.basename(file, '.gml'),
        });
      }
    } else if (asset.isKind('rooms')) {
      const instances = new Map(
        asset.roomInstances.map((i) => [i.creationCodeFile?.toLowerCase(), i]),
      );
      for (const file of asset.gmlFiles) {
        const instance = instances.get(file.toLowerCase());
        files.push(
          instance
            ? {
                id: rel(file),
                kind: 'instanceCreation',
                asset: asset.name,
                object: instance.objectName,
              }
            : { id: rel(file), kind: 'roomCreation', asset: asset.name },
        );
      }
    }
  }
  return files;
}

/** Describe a project's assets for the analyzer */
export function projectInfo(project: GameMakerProject): ProjectInfo {
  const extensions: ExtensionInfo[] = [];
  for (const asset of project.listAssets('extensions')) {
    const yy = asset.yy as {
      files?: {
        constants?: { name: string; value: string; hidden?: boolean }[];
        functions?: {
          name: string;
          externalName: string;
          args: number[];
          returnType: number;
          help?: string;
          hidden?: boolean;
        }[];
      }[];
    };
    for (const file of yy.files ?? []) {
      extensions.push({
        constants: (file.constants ?? []).filter((c) => !c.hidden),
        functions: (file.functions ?? []).filter((f) => !f.hidden),
      });
    }
  }
  const rel = (file: string) =>
    path.relative(project.dir, file).split(path.sep).join('/');
  return {
    assets: project.listAssets().map((a) => ({
      name: a.name,
      kind: a.kind,
      parent: a.parentName,
      variables: a.isKind('objects')
        ? (
            (
              a.yy as {
                properties?: {
                  name: string;
                  varType: number;
                  value?: string;
                }[];
              }
            ).properties ?? []
          ).map((p) => ({
            name: p.name,
            varType: p.varType,
            value: p.value,
            file: rel(a.yyPath),
          }))
        : undefined,
    })),
    audioGroups: project.audioGroups.map((g) => g.name),
    extensions,
  };
}

export interface AnalyzeProjectOptions extends AnalyzerOptions {
  /** GmlSpec files to load natives from (default: the bundled spec) */
  specs?: (string | URL)[] | GmlSpec[];
}

/** Load natives, read every GML file, and analyze the project */
export async function analyzeProject(
  project: GameMakerProject,
  options: AnalyzeProjectOptions = {},
): Promise<GmlAnalyzer> {
  const specSources = options.specs?.length
    ? options.specs
    : [fallbackGmlSpecPath];
  const specs = await Promise.all(
    specSources.map((s) =>
      typeof s === 'string' || s instanceof URL ? readGmlSpec(s) : s,
    ),
  );
  const analyzer = new GmlAnalyzer(new NativeTable(specs), options);
  analyzer.setProject(projectInfo(project));
  const files = listSourceFiles(project);
  // (Bounded, to avoid running out of file handles in large projects)
  const texts = await mapConcurrent(files, 64, (f) =>
    fs.readFile(path.join(project.dir, f.id), 'utf8'),
  );
  files.forEach((file, i) => analyzer.setFile(file, texts[i]));
  analyzer.analyze();
  return analyzer;
}

/**
 * The dependencies between a project's assets found in its code: each asset
 * whose code refers to a global symbol declared in another asset's code, or
 * to another asset by name. For `importAssets` (in
 * `@bscotch/gamemaker-project`), which finds the other kinds of dependencies
 * itself.
 */
export function listCodeDependencies(
  project: GameMakerProject,
  analyzer: GmlAnalyzer,
): AssetDependency[] {
  const assetOfFile = new Map(
    listSourceFiles(project).map((f) => [f.id, f.asset] as const),
  );
  const table = analyzer.table;
  const found = new Map<string, AssetDependency>();
  for (const fileId of analyzer.fileIds) {
    const requiredBy = project.getAsset(assetOfFile.get(fileId));
    if (!requiredBy) continue;
    for (const ref of analyzer.getAnalysis(fileId)?.refs ?? []) {
      if (ref.keyword) continue;
      const symbol = table.getSymbol(ref.symbol);
      if (!symbol || symbol.native || symbol.owner !== ids.globalShape) {
        continue;
      }
      const requirement = project.getAsset(
        symbol.kind === 'asset'
          ? symbol.name
          : assetOfFile.get(symbol.def?.file ?? ''),
      );
      if (!requirement || requirement === requiredBy) continue;
      const key = `${requiredBy.name}/${requirement.name}/${symbol.name}`;
      if (found.has(key)) continue;
      found.set(key, {
        relationship: 'code',
        requiredBy: { name: requiredBy.name, kind: requiredBy.kind },
        requirement: { name: requirement.name, kind: requirement.kind },
        symbol: symbol.name,
      });
    }
  }
  return [...found.values()];
}
