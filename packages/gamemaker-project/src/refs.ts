/**
 * Helpers for finding and updating references to assets inside yy/yyp data.
 *
 * GameMaker always stores a reference to an asset as a `{name, path}` object,
 * where `path` is the project-relative path to the asset's yy file, e.g.
 * `{"name":"spr_player","path":"sprites/spr_player/spr_player.yy"}`.
 *
 * (Room instance-creation-order entries look the same, but their `name` is the
 * instance's name while their `path` is the room's.)
 */
import type { YypResourceId } from '@bscotch/yy';
import { key } from './util.ts';

const assetYyPathPattern = /^[a-z]+\/[^/]+\/[^/]+\.yy$/i;

function isAssetRef(value: unknown): value is YypResourceId {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    typeof v.path === 'string' &&
    assetYyPathPattern.test(v.path)
  );
}

function visitRefs(data: unknown, visit: (ref: YypResourceId) => void) {
  const stack: unknown[] = [data];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (isAssetRef(value)) visit(value);
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') stack.push(child);
    }
  }
}

/** The (lowercased) yy paths of all assets referenced in some yy data */
export function listReferencedPaths(data: unknown): Set<string> {
  const paths = new Set<string>();
  visitRefs(data, (ref) => paths.add(key(ref.path)));
  return paths;
}

export function referencesPath(data: unknown, yyPath: string): boolean {
  return listReferencedPaths(data).has(key(yyPath));
}

/**
 * Point every reference to the asset at `from` to `to` instead, in place.
 * Returns the number of references updated.
 */
export function replaceRefs(
  data: unknown,
  from: YypResourceId,
  to: YypResourceId,
): number {
  let count = 0;
  const fromPath = key(from.path);
  const fromName = key(from.name);
  visitRefs(data, (ref) => {
    if (key(ref.path) !== fromPath) return;
    ref.path = to.path;
    if (key(ref.name) === fromName) ref.name = to.name;
    count++;
  });
  return count;
}
