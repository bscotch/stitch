import type { Dependency, ImportModuleOptions } from './modules.types.js';
import { StitchImportError, assertStitchImportClaim } from './modules.util.js';
import { Asset, isAssetOfKind } from './project.asset.js';
import type { Project } from './project.js';
import type { Signifier } from './signifiers.js';
import { findYyFile, groupPathToPosix, neither, xor } from './util.js';
export type * from './modules.types.js';

/**
 * @param sourceFolder Full folder path to import from (e.g. `Scripts/MainMenu`)
 */
export async function importAssets(
  sourceProject: Project,
  targetProject: Project,
  options: ImportModuleOptions = {},
) {
  const logFile = targetProject.dir.join('stitch-import.log.yaml');
  assertStitchImportClaim(
    neither(options.sourceFolder, options.sourceAsset) ||
      xor(options.sourceAsset, options.sourceFolder),
    'Can specify either sourceFolder or sourceAsset, or neither, but not both.',
  );

  // Identify all assets we want to import
  const intendedImports = new Map<string, Asset>();
  if (options.sourceAsset) {
    const asset = sourceProject.getAssetByName(options.sourceAsset, {
      assertExists: true,
    });
    intendedImports.set(asset.name, asset);
  } else {
    for (const [name, asset] of sourceProject.assets) {
      if (!options.sourceFolder || asset.isInFolder(options.sourceFolder)) {
        intendedImports.set(name, asset);
      }
    }
  }

  // Remove any assets that are not of the specified types
  if (options.types?.length) {
    for (const [name, asset] of intendedImports) {
      if (!options.types.includes(asset.assetKind)) {
        intendedImports.delete(name);
      }
    }
  }

  // Identify all dependencies of those assets that would be
  // missing in the target project *after import*
  const sourceDeps = computeAssetDeps(sourceProject);
  const missingDeps = new Set<Dependency>();
  const conflictingDeps = new Set<Dependency>();
  let newMissingAssets: Asset[] = [];
  for (const depList of sourceDeps.values()) {
    newMissingAssets.push(
      ...updateMissingDeps(
        depList,
        intendedImports,
        missingDeps,
        conflictingDeps,
        targetProject,
        sourceProject,
      ),
    );
  }
  // We now have our first-layer deep of missing deps. To recursively
  // populate *all* missing deps we need to repeat this process on the
  // missing deps we find until we have no more missing deps. Preventing
  // infinite loops here is essential!
  // To do this, create a new list of "intended imports" representing
  // if we were to import *everything* connected to the originally-desired
  // imports.
  const derivedImports = new Map<string, Asset>();
  // Start with the original intended imports
  for (const [name, asset] of intendedImports) {
    derivedImports.set(name, asset);
  }

  while (newMissingAssets.length) {
    for (const asset of newMissingAssets) {
      derivedImports.set(asset.name, asset);
    }
    const newMissingDeps = newMissingAssets
      .map((a) => sourceDeps.get(a)!)
      .flat() as Dependency[];

    // Find the *newly* missing deps from this new list
    newMissingAssets = updateMissingDeps(
      newMissingDeps,
      derivedImports,
      missingDeps,
      conflictingDeps,
      targetProject,
      sourceProject,
    );
  }

  // Conflicting deps should not be allowed at all.
  if (conflictingDeps.size > 0) {
    await logFile.write({
      conflicts: conflictingDeps,
    });
    throw new StitchImportError(
      `Cannot import because of conflicting dependencies. See the logs for details: "${logFile}"`,
    );
  }

  // By default, missing deps should cause an error
  const { onMissingDependency } = options;
  if (
    missingDeps.size &&
    (!onMissingDependency || onMissingDependency === 'error')
  ) {
    await logFile.write({
      missing: missingDeps,
    });
    throw new StitchImportError(
      `Cannot import because of conflicting dependencies. See the logs for details: "${logFile}"`,
    );
  }

  const sourceFolder = groupPathToPosix(options.sourceFolder || '');
  const targetFolder = groupPathToPosix(options.targetFolder || sourceFolder);

  const waits: Promise<any>[] = [];
  const summary = {
    created: [] as string[],
    updated: [] as string[],
    errors: [] as string[],
    skipped: [] as string[],
  };

  for (const [name, asset] of derivedImports) {
    const skip =
      onMissingDependency !== 'include' && !intendedImports.has(asset.name);
    if (skip) {
      summary.skipped.push(asset.name);
      continue;
    }

    // Ensure we have the target folder
    let folder = groupPathToPosix(asset.folder);
    if (sourceFolder && targetFolder) {
      folder =
        folder === sourceFolder
          ? targetFolder
          : folder.replace(sourceFolder + '/', targetFolder + '/');
    }
    // Copy over the asset files
    const targetDir = targetProject.dir.join(
      asset.dir.relativeFrom(sourceProject.dir),
    );

    waits.push(
      targetDir
        .ensureDir()
        .then(() => targetDir.rm({ recursive: true, maxRetries: 5 }))
        .then(() => asset.dir.copy(targetDir))
        .then(() => targetProject.createFolder(folder, { skipSave: true }))
        .then(async () => {
          let existingAsset = targetProject.getAssetByName(asset.name);
          if (!existingAsset) {
            const yyFile = await findYyFile(targetDir);
            const info = await targetProject.addAssetToYyp(yyFile.absolute, {
              skipSave: true,
            });

            // Create and add the asset
            existingAsset = await Asset.from(targetProject, info);
            if (existingAsset) {
              targetProject.registerAsset(existingAsset);
              summary.created.push(existingAsset.name);
            } else {
              summary.errors.push(`Failed to create asset for ${asset.name}`);
            }
          } else {
            await existingAsset.reload();
          }
          // Ensure the correct folder
          await existingAsset?.moveToFolder(folder);
          return existingAsset;
        })
        .catch((err) => {
          summary.errors.push(
            `Failed to import asset ${asset.name}: ${err.message}`,
          );
        }),
    );
  }
  await Promise.all(waits);
  await targetProject.saveYyp();
  await logFile.write(summary);
  return summary;
}

function updateMissingDeps(
  depList: Dependency[],
  intendedImports: Map<string, Asset>,
  missingDeps: Set<Dependency>,
  conflictingDeps: Set<Dependency>,
  targetProject: Project,
  sourceProject: Project,
): Asset[] {
  const newMissingDeps: Asset[] = [];
  const addMissingDep = (dep: Dependency) => {
    if (!missingDeps.has(dep)) {
      newMissingDeps.push(
        sourceProject.getAssetByName(dep.requirement.name, {
          assertExists: true,
        }),
      );
      missingDeps.add(dep);
    }
  };

  for (const dep of depList) {
    // Wrap this in a function so it can recurse on missing deps
    if (!intendedImports.has(dep.requiredBy.name)) {
      // Then it doesn't matter what is being required, since
      // we're not trying to import this.
      continue;
    }
    if (intendedImports.has(dep.requirement.name)) {
      // Then we're already intending to import this, so it's not missing. BUT. It may create conflicts if it replaces something!

      // Is there a globalvar with the same name?
      const targetVar = targetProject.self.getMember(dep.requirement.name);
      if (targetVar && !targetVar.asset) {
        // Then this is a variable that is being replaced by an asset. This is not allowed.
        conflictingDeps.add(dep);
        continue;
      }

      // Is there an asset with the same name but different type?
      const targetAsset = targetProject.getAssetByName(dep.requirement.name);
      if (targetAsset && targetAsset.assetKind !== dep.requirement.kind) {
        conflictingDeps.add(dep);
        continue;
      }

      // If we replace the target asset, will we lose anything
      // that is required by something else in the target?
      if (targetAsset?.gmlFiles.size) {
        // Then we're replacing an asset that has code, so we need to check if any of the things it defines are required by other *target* assets and *not* included in the import.
        const varsDefinedByTarget = listGlobalvarsDefinedByAsset(targetAsset);

        for (const targetVar of varsDefinedByTarget) {
          // Do any intended imports include this?
          const inSource = sourceProject.self.getMember(targetVar.name);
          const fromSourceAsset = inSource && inSource.def?.file?.asset;
          if (!fromSourceAsset || !intendedImports.has(fromSourceAsset.name)) {
            // Then we're losing a variable that is required by something else in the target project.
            conflictingDeps.add(dep);
          }
        }
      }
    }

    // If this is a parent/child/ref relationship, we just
    // need to ensure that the target has an asset of the same
    // type with that name.
    if (['parent', 'child', 'ref'].includes(dep.relationship)) {
      const targetAsset = targetProject.getAssetByName(dep.requirement.name);
      if (!targetAsset) {
        addMissingDep(dep);
      } else if (targetAsset.assetKind !== dep.requirement.kind) {
        conflictingDeps.add(dep);
      }
    } else if (dep.relationship === 'code') {
      // For simplicity, just see if any global entity with the
      // same name exists (could check types in the future).
      const existsInTarget =
        targetProject.self.getMember(dep.signifier) ||
        targetProject.getAssetByName(dep.signifier);
      if (!existsInTarget) {
        addMissingDep(dep);
      }
    }
  }
  return newMissingDeps;
}

/**
 * Create a map listing all assets in a project and how they
 * depend on other assets in same.
 */
export function computeAssetDeps(project: Project): Map<Asset, Dependency[]> {
  const dependencies = new Map<Asset, Dependency[]>();
  for (const [, asset] of project.assets) {
    const deps: Dependency[] = [];
    dependencies.set(asset, deps);

    // Handle object-specific dependencies (parent objects and sprite assignments)
    if (isAssetOfKind(asset, 'objects')) {
      if (asset.parent) {
        deps.push({
          relationship: 'parent',
          requiredBy: { name: asset.name, kind: 'objects' },
          requirement: { name: asset.parent.name, kind: 'objects' },
        });
      }
      if (asset.sprite) {
        deps.push({
          relationship: 'child',
          requiredBy: { name: asset.name, kind: 'objects' },
          requirement: { name: asset.sprite.name, kind: 'sprites' },
        });
      }
    }

    // Handle code dependencies (referenced signifiers)
    for (const gmlFile of asset.gmlFiles.values()) {
      for (const ref of gmlFile.refs) {
        // This could be a child of something, so get to the root-most
        // signifier.
        const seenItems = new Set<Signifier>();
        let item = ref.item;
        while (item.parent) {
          if (item.parent.signifier?.name === 'global') break;
          item = item.parent.signifier || item;
          // Prevent circularity!
          if (!item.parent.signifier || seenItems.has(item)) break;
          seenItems.add(item);
        }

        // Skip native, local, and janky signifiers
        if (item.native || item.local || !item.def?.file) continue;

        const itemAsset = item.def.file.asset;

        // Skip intra-asset references
        if (itemAsset === asset) continue;

        if (item.asset) {
          // Then this is a reference to an asset, not a code signifier
          deps.push({
            relationship: 'ref',
            requiredBy: { name: asset.name, kind: asset.assetKind },
            requirement: {
              name: itemAsset.name,
              kind: itemAsset.assetKind,
            },
          });
        } else {
          // It's a code signifier
          deps.push({
            relationship: 'code',
            requiredBy: { name: asset.name, kind: asset.assetKind },
            requirement: { name: itemAsset.name, kind: itemAsset.assetKind },
            signifier: item.name,
            def: {
              file: item.def.file.path.relative,
              line: item.def.start.line,
              column: item.def.start.column,
            },
            ref: {
              file: ref.file.path.relative,
              line: ref.start.line,
              column: ref.start.column,
            },
          });
        }
      }
    }
  }
  return dependencies;
}

function listGlobalvarsDefinedByAsset(asset: Asset): Set<Signifier> {
  const vars = new Set<Signifier>();
  for (const gmlFile of asset.gmlFiles.values()) {
    for (const ref of gmlFile.refs) {
      const { item } = ref;
      if (
        item.local ||
        item.native ||
        !item.global ||
        !item.def?.file ||
        item.def.file.asset !== asset
      ) {
        continue;
      }
      vars.add(item);
    }
  }
  return vars;
}
