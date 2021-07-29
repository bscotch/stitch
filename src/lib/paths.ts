import nodePath from 'path';

/**
 * Given a path with any style of separators,
 * return the same path with POSIX-style separators.
 */
function asPosixPath(pathString: string) {
  const parts = pathString.split(/[/\\]+/g);
  const withPosixSeps = nodePath.posix.join(...parts);
  // When converting a Windows absolute path, e.g. C:// must become /c/
  return withPosixSeps.replace(/^([a-z])\/\//i, '/$1/');
}

function trimTrailingSlash(pathString: string) {
  return pathString.replace(/[/\\]+$/, '');
}

function pathParts(pathString: string) {
  return pathString.split(/[/\\]+/g);
}

/**
 * Get the number of directory levels between a child and
 * parent. Treats both as paths for directories and trims trailing slashes.
 * Ignores case!
 *
 * For example:
 *
 * - If the parent and child are the same, returns `0`.
 * - If the child is an immediate child of the parent, returns `1`.
 * - If the child is not inside parent at all, returns `NaN`.
 */
function generationsFromParent(parent: string, child: string) {
  const parentParts = pathParts(trimTrailingSlash(parent.toLocaleLowerCase()));
  const childParts = pathParts(trimTrailingSlash(child.toLocaleLowerCase()));
  let common = 0;
  while (
    common < parentParts.length &&
    common < childParts.length &&
    parentParts[common] == childParts[common]
  ) {
    common++;
  }
  if (common == 0) {
    return NaN;
  }
  return childParts.length - common;
}

/**
 * For a set of parents and a child, return the parent closest
 * to that child (if there is one, else return `undefined`).
 */
function findClosestParent(parents: string[], child: string) {
  let closestParent: string | undefined;
  let closestParentGenerationsAway = Infinity;
  for (const parent of parents) {
    const generationsAway = generationsFromParent(parent, child);
    if (
      !isNaN(generationsAway) &&
      generationsAway < closestParentGenerationsAway
    ) {
      closestParent = parent;
      closestParentGenerationsAway = generationsAway;
    }
  }
  return closestParent;
}

/**
 * Pass to `.sort()` got an array of paths to get
 * them sorted by *least* to *most* specific (i.e.
 * fewest to most subdirs) and alphabetically by
 * directory within a specificity tier.
 */
function pathSpecificitySort(path1: string, path2: string) {
  const path1Parts = pathParts(path1);
  const path2Parts = pathParts(path2);
  if (path1Parts.length != path2Parts.length) {
    return path1Parts.length - path2Parts.length;
  }
  // Sort alphabetically but by folder
  for (let i = 0; i < path1Parts.length; i++) {
    const part1 = path1Parts[i].toLowerCase();
    const part2 = path2Parts[i].toLowerCase();
    if (part1 == part2) {
      continue;
    }
    return part1 < part2 ? -1 : 1;
  }
  return 0;
}

/**
 * Given a path, return all of the parent paths
 * leading up to it. Sorted by least to most specific
 * (e.g. /hello comes before /hello/world)
 */
function heirarchy(path: string) {
  const paths: string[] = [path];
  while (nodePath.dirname(path) != path) {
    path = nodePath.dirname(path);
    paths.push(path);
  }
  paths.reverse();
  return paths.filter((p) => p != '.');
}

/**
 * Given the path to a directory, return the final subdirectory name.
 * E.g. from /hello/world/ return "world".
 */
function subfolderName(directoryPath: string) {
  return nodePath.parse(trimTrailingSlash(directoryPath)).base;
}

function changeExtension(path: string, newExtension: string) {
  return path.replace(/\.[^.]+$/, `.${newExtension}`);
}

export default {
  ...nodePath,
  pathSpecificitySort,
  heirarchy,
  asPosixPath,
  subfolderName,
  changeExtension,
  generationsFromParent,
  findClosestParent,
};
