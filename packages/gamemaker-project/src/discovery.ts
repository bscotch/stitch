/**
 * Telling real projects apart from other `.yyp` files found by a search.
 */
import path from 'node:path';

export type YypKind =
  /** A project that isn't inside another project's folder */
  | 'project'
  /** A prefab, stored in a project's `prefabs/` folder */
  | 'prefab'
  /** Any other `.yyp` inside another project's folder (e.g. a copy, or test data) */
  | 'nested';

export interface ClassifiedYyp {
  /** The path, as given */
  path: string;
  kind: YypKind;
}

/**
 * Classify `.yyp` files found by searching (e.g. a workspace), so that only
 * real projects are offered to the user:
 * - A `.yyp` in a subfolder of a `prefabs` folder is a prefab. GameMaker
 *   stores prefabs in the `prefabs/` folder of the projects that use them.
 * - Any other `.yyp` inside the folder of another `.yyp` is nested.
 * - Everything else is a project.
 *
 * Projects don't have to be at the root of the searched folder: a project in
 * a subfolder of a repository is still a project.
 */
export function classifyYypPaths(paths: readonly string[]): ClassifiedYyp[] {
  const normalize = (p: string) =>
    path.resolve(p).split(path.sep).join('/').toLowerCase();
  const dirs = paths.map((p) => path.posix.dirname(normalize(p)));
  return paths.map((original, i) => {
    const dir = dirs[i];
    const segments = dir.split('/');
    const isInsideAnother = dirs.some(
      (other, j) => j !== i && other !== dir && dir.startsWith(`${other}/`),
    );
    // GameMaker's layout is `prefabs/<name>/<name>.yyp`
    const inPrefabsFolder = segments.at(-2) === 'prefabs';
    const kind: YypKind = inPrefabsFolder
      ? 'prefab'
      : isInsideAnother
        ? 'nested'
        : 'project';
    return { path: original, kind };
  });
}
