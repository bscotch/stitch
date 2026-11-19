/**
 * Minimal semver helpers (parse/compare/increment), kept dependency-free
 * so that CI jobs can run release scripts without installing packages.
 */

export type Bump = 'patch' | 'minor' | 'major';

/** Bump types in ascending order of precedence. */
export const BUMP_ORDER: readonly Bump[] = ['patch', 'minor', 'major'];

const semverPattern =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<build>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export function parseVersion(version: string): ParsedVersion | undefined {
  const groups = version.match(semverPattern)?.groups;
  if (!groups) return undefined;
  return {
    major: Number(groups.major),
    minor: Number(groups.minor),
    patch: Number(groups.patch),
    prerelease: groups.prerelease ? groups.prerelease.split('.') : [],
  };
}

export function isValidVersion(version: string): boolean {
  return !!parseVersion(version);
}

function mustParse(version: string): ParsedVersion {
  const parsed = parseVersion(version);
  if (!parsed) throw new Error(`Invalid semver version: "${version}"`);
  return parsed;
}

function comparePrereleaseIds(a: string, b: string): number {
  const aNum = /^\d+$/.test(a);
  const bNum = /^\d+$/.test(b);
  if (aNum && bNum) return Math.sign(Number(a) - Number(b));
  if (aNum) return -1;
  if (bNum) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Returns -1, 0, or 1 (semver precedence; build metadata ignored). */
export function compareVersions(a: string, b: string): number {
  const pa = mustParse(a);
  const pb = mustParse(b);
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (pa[key] !== pb[key]) return Math.sign(pa[key] - pb[key]);
  }
  // A version without a prerelease has higher precedence
  if (!pa.prerelease.length || !pb.prerelease.length) {
    return Math.sign(pb.prerelease.length - pa.prerelease.length);
  }
  const length = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < length; i++) {
    const ai = pa.prerelease[i];
    const bi = pb.prerelease[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;
    const cmp = comparePrereleaseIds(ai, bi);
    if (cmp) return cmp;
  }
  return 0;
}

/**
 * Increment a version. Matches `semver.inc()` for release (non-prerelease)
 * bumps: a prerelease version is "finalized" when the bump level allows it.
 */
export function incrementVersion(version: string, bump: Bump): string {
  const { major, minor, patch, prerelease } = mustParse(version);
  const isPre = prerelease.length > 0;
  switch (bump) {
    case 'major':
      return isPre && minor === 0 && patch === 0
        ? `${major}.0.0`
        : `${major + 1}.0.0`;
    case 'minor':
      return isPre && patch === 0
        ? `${major}.${minor}.0`
        : `${major}.${minor + 1}.0`;
    case 'patch':
      return isPre
        ? `${major}.${minor}.${patch}`
        : `${major}.${minor}.${patch + 1}`;
  }
}

/** Return the highest-precedence bump, or `undefined` if there are none. */
export function maxBump(bumps: Iterable<Bump | undefined>): Bump | undefined {
  let max: Bump | undefined;
  for (const bump of bumps) {
    if (!bump) continue;
    if (!max || BUMP_ORDER.indexOf(bump) > BUMP_ORDER.indexOf(max)) {
      max = bump;
    }
  }
  return max;
}
