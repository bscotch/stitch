import type {
  Dependency,
  ImportAction,
  ImportModuleOptions,
} from './modules.types.js';
import { isAssetOfKind, type Asset } from './project.asset.js';
import type { Project } from './project.js';
import type { Signifier } from './signifiers.js';

/**
 * @param sourceFolder Full folder path to import from (e.g. `Scripts/MainMenu`)
 */
export async function importModule(
  sourceProject: Project,
  targetProject: Project,
  sourceFolder: string,
  options: ImportModuleOptions = {},
) {
  const targetFolder = options.targetFolder || sourceFolder;

  const sourceDeps = computeAssetDeps(sourceProject);
  const targetDeps = computeAssetDeps(targetProject);

  const tasks: ImportAction[] = [];
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
          requiredByAsset: { name: asset.name, kind: 'objects' },
          requirement: { name: asset.parent.name, kind: 'objects' },
        });
      }
      if (asset.sprite) {
        deps.push({
          relationship: 'child',
          requiredByAsset: { name: asset.name, kind: 'objects' },
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

        // Skip native and janky signifiers
        if (item.native || !item.def?.file) continue;

        const itemAsset = item.def.file.asset;

        // Skip intra-asset references
        if (itemAsset === asset) continue;

        if (item.asset) {
          // Then this is a reference to an asset, not a code signifier
          deps.push({
            relationship: 'ref',
            requiredByAsset: { name: asset.name, kind: asset.assetKind },
            requirement: {
              name: itemAsset.name,
              kind: itemAsset.assetKind,
            },
          });
        } else {
          // It's a code signifier
          deps.push({
            relationship: 'code',
            requiredByAsset: { name: asset.name, kind: asset.assetKind },
            requirement: { name: itemAsset.name, kind: itemAsset.assetKind },
            signifier: item.name,
            def: {
              file: item.def.file.path.absolute,
              line: item.def.start.line,
              column: item.def.start.column,
            },
            ref: {
              file: ref.file.path.absolute,
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
