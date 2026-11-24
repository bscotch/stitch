/**
 * Importing assets from one project into another ("modules").
 */
import { Yy } from '@bscotch/yy';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Asset, AssetKind } from './asset.ts';
import type { GameMakerProject } from './project.ts';
import { listReferencedPaths } from './refs.ts';
import { assert, folderPathToPosix, key } from './util.ts';

export interface AssetDependency {
  /**
   * - `parent`: an object's parent object
   * - `ref`: any other reference in the yy file (an object's sprite, a room's objects, ...)
   * - `code`: a reference in GML code (provided by a code-aware layer)
   */
  relationship: 'parent' | 'ref' | 'code';
  requiredBy: { name: string; kind: AssetKind };
  requirement: { name: string; kind: AssetKind };
  /** For `code` dependencies, the referenced symbol */
  symbol?: string;
}

export interface ImportOptions {
  /** Import the assets in this folder (and its subfolders) of the source project */
  sourceFolder?: string;
  /** Import just this asset */
  sourceAsset?: string;
  /** The folder to import into. Defaults to `sourceFolder`. */
  targetFolder?: string;
  /** Only import assets of these kinds */
  kinds?: AssetKind[];
  /**
   * What to do about dependencies of the imported assets that are in neither
   * the import nor the target project:
   * - `error` (default): abort the import
   * - `skip`: import anyway
   * - `include`: import them too (recursively)
   */
  onMissingDependency?: 'error' | 'skip' | 'include';
  /**
   * Extra dependencies, such as code dependencies found by a code-aware
   * layer. Dependencies found in yy files are added automatically.
   */
  dependencies?: AssetDependency[];
  /**
   * For `code` dependencies: whether the target project already defines a
   * symbol (so the dependency isn't missing). By default, only assets count.
   */
  targetHasSymbol?: (name: string) => boolean;
  /**
   * Called for each target asset that would be replaced by an imported one.
   * Return a reason to block the import (e.g. because other code in the
   * target needs something only the old version defines).
   */
  checkReplacement?: (source: Asset, target: Asset) => string | undefined;
}

export interface ImportConflict {
  asset: string;
  reason: string;
}

export interface ImportResult {
  created: string[];
  replaced: string[];
  /** Missing dependencies that were not imported (with `onMissingDependency: 'skip'`) */
  missing: AssetDependency[];
}

export class ImportError extends Error {
  readonly conflicts: ImportConflict[];
  readonly missing: AssetDependency[];
  constructor(
    message: string,
    details: { conflicts?: ImportConflict[]; missing?: AssetDependency[] },
  ) {
    super(message);
    this.name = 'ImportError';
    this.conflicts = details.conflicts || [];
    this.missing = details.missing || [];
  }
}

/** List the dependencies between a project's assets found in their yy files */
export function listYyDependencies(
  project: GameMakerProject,
): AssetDependency[] {
  const byPath = new Map(
    project.listAssets().map((a) => [key(a.id.path), a] as const),
  );
  const deps: AssetDependency[] = [];
  for (const asset of project.assets) {
    const parent = asset.parentName && project.getAsset(asset.parentName);
    for (const refPath of listReferencedPaths(asset.yy)) {
      const requirement = byPath.get(refPath);
      if (!requirement || requirement === asset) continue;
      deps.push({
        relationship: requirement === parent ? 'parent' : 'ref',
        requiredBy: { name: asset.name, kind: asset.kind },
        requirement: { name: requirement.name, kind: requirement.kind },
      });
    }
  }
  return deps;
}

/**
 * Plan an import: which assets would be imported, and what's missing or in
 * conflict. Doesn't change anything.
 */
export function planImport(
  source: GameMakerProject,
  target: GameMakerProject,
  options: ImportOptions = {},
): {
  assets: Asset[];
  missing: AssetDependency[];
  conflicts: ImportConflict[];
} {
  assert(
    !(options.sourceFolder && options.sourceAsset),
    'Specify sourceFolder or sourceAsset, not both',
  );
  const intended = new Map<string, Asset>();
  if (options.sourceAsset) {
    const asset = source.requireAsset(options.sourceAsset);
    intended.set(key(asset.name), asset);
  } else {
    for (const asset of source.assets) {
      if (!options.sourceFolder || asset.isInFolder(options.sourceFolder)) {
        intended.set(key(asset.name), asset);
      }
    }
  }
  if (options.kinds?.length) {
    for (const [name, asset] of intended) {
      if (!options.kinds.includes(asset.kind)) intended.delete(name);
    }
  }

  const depsByAsset = new Map<string, AssetDependency[]>();
  for (const dep of [
    ...listYyDependencies(source),
    ...(options.dependencies || []),
  ]) {
    const k = key(dep.requiredBy.name);
    if (!depsByAsset.has(k)) depsByAsset.set(k, []);
    depsByAsset.get(k)!.push(dep);
  }

  const toImport = new Map(intended);
  const missing: AssetDependency[] = [];
  const conflicts: ImportConflict[] = [];
  const queue = [...intended.values()];
  while (queue.length) {
    const asset = queue.pop()!;
    for (const dep of depsByAsset.get(key(asset.name)) || []) {
      const name = dep.requirement.name;
      if (toImport.has(key(name))) continue;
      const inTarget = target.getAsset(name);
      if (inTarget) {
        if (
          dep.relationship !== 'code' &&
          inTarget.kind !== dep.requirement.kind
        ) {
          conflicts.push({
            asset: name,
            reason: `"${asset.name}" needs ${dep.requirement.kind} "${name}", but the target's "${name}" is ${inTarget.kind}`,
          });
        }
        continue;
      }
      if (
        dep.relationship === 'code' &&
        dep.symbol &&
        options.targetHasSymbol?.(dep.symbol)
      ) {
        continue;
      }
      missing.push(dep);
      const required = source.getAsset(name);
      if (options.onMissingDependency === 'include' && required) {
        toImport.set(key(name), required);
        queue.push(required);
      }
    }
  }

  for (const asset of toImport.values()) {
    const existing = target.getAsset(asset.name);
    if (!existing) continue;
    if (existing.kind !== asset.kind) {
      conflicts.push({
        asset: asset.name,
        reason: `The target already has a ${existing.kind} named "${existing.name}"`,
      });
      continue;
    }
    const reason = options.checkReplacement?.(asset, existing);
    if (reason) conflicts.push({ asset: asset.name, reason });
  }
  return {
    assets: [...toImport.values()],
    missing: options.onMissingDependency === 'include' ? [] : missing,
    conflicts,
  };
}

/**
 * Import assets from one project into another, as one transaction. Assets
 * that already exist in the target (with the same name and kind) are
 * replaced.
 */
export async function importAssets(
  source: GameMakerProject,
  target: GameMakerProject,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const plan = planImport(source, target, options);
  if (plan.conflicts.length) {
    throw new ImportError(
      `Cannot import: ${plan.conflicts.length} conflict(s). ${plan.conflicts
        .map((c) => `${c.asset}: ${c.reason}`)
        .join('; ')}`,
      { conflicts: plan.conflicts },
    );
  }
  const onMissing = options.onMissingDependency || 'error';
  if (plan.missing.length && onMissing === 'error') {
    throw new ImportError(
      `Cannot import: missing dependencies: ${[
        ...new Set(plan.missing.map((d) => d.requirement.name)),
      ].join(', ')}`,
      { missing: plan.missing },
    );
  }

  const sourceFolder = folderPathToPosix(options.sourceFolder || '');
  const targetFolder = folderPathToPosix(options.targetFolder || sourceFolder);
  const result: ImportResult = {
    created: [],
    replaced: [],
    missing: plan.missing,
  };

  await target.transaction(async (tx) => {
    const yyp = await tx.yyp();
    for (const asset of plan.assets) {
      let folder = asset.folder;
      if (sourceFolder && key(folder) === key(sourceFolder)) {
        folder = targetFolder;
      } else if (
        sourceFolder &&
        key(folder).startsWith(key(`${sourceFolder}/`))
      ) {
        folder = `${targetFolder}/${folder.slice(sourceFolder.length + 1)}`;
      }
      const existing = target.getAsset(asset.name);
      const dir = path.join(target.dir, asset.kind, asset.name);
      if (existing) {
        // Keep the old version until the import succeeds
        const backup = `${existing.dir}.stitch-backup`;
        await fs.rm(backup, { recursive: true, force: true });
        await tx.rename(existing.dir, backup);
        tx.deleteOnCommit(backup);
        result.replaced.push(asset.name);
      } else {
        result.created.push(asset.name);
      }
      await tx.copyDir(asset.dir, dir);
      const yy = Yy.parse(await fs.readFile(asset.yyPath, 'utf8')) as Record<
        string,
        unknown
      >;
      yy.parent = await tx.ensureFolder(folder);
      tx.stageYy(
        path.join(dir, path.basename(asset.yyPath)),
        asset.kind,
        yy as any,
      );
      const id = {
        name: asset.name,
        path: `${asset.kind}/${asset.name}/${path.basename(asset.yyPath)}`,
      };
      const listed = yyp.resources.find(
        (r) => key(r.id.name) === key(asset.name),
      );
      if (listed) listed.id = id;
      else yyp.resources.push({ id });
      if (
        asset.kind === 'rooms' &&
        !yyp.RoomOrderNodes.some((n) => key(n.roomId.name) === key(asset.name))
      ) {
        yyp.RoomOrderNodes.push({ roomId: { ...id } });
      }
    }
  });
  return result;
}
