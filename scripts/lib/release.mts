import { run } from './exec.mts';
import type { VersionTag } from './git.mts';
import { compareVersions } from './semver.mts';
import type { Project } from './workspace.mts';
import { sortTopologically } from './workspace.mts';

/** Read-only view of the npm registry. */
export interface Registry {
  /** The `latest` dist-tag version, or `undefined` if the package is unpublished. */
  latest(name: string): string | undefined;
  /** Whether this exact version has been published. */
  has(name: string, version: string): boolean;
}

export interface ReleasePlan {
  /** Every tagged project name (public or private), e.g. to trigger other workflows */
  tagged: string[];
  /** Public packages to publish to npm, in dependency order */
  publish: { name: string; version: string; dir: string }[];
  /** Public packages skipped because that version is already on npm */
  alreadyPublished: { name: string; version: string }[];
}

/**
 * Decide what to publish given the version tags created by a release,
 * with the project manifests as they exist at the commit being released.
 *
 * Throws if a tag doesn't match its manifest, or if a version is lower
 * than what is already `latest` on npm (e.g. clobbered by a merge).
 */
export function planRelease(
  tags: VersionTag[],
  /** Projects as of the commit being released */
  projects: Pick<
    Project,
    'name' | 'version' | 'dir' | 'private' | 'manifest'
  >[],
  registry: Registry,
): ReleasePlan {
  // Only the highest tag per project matters
  const tagged = new Map<string, string>();
  for (const { name, version } of tags) {
    const current = tagged.get(name);
    if (!current || compareVersions(version, current) > 0) {
      tagged.set(name, version);
    }
  }

  const problems: string[] = [];
  const toPublish: typeof projects = [];
  const alreadyPublished: ReleasePlan['alreadyPublished'] = [];
  for (const [name, version] of tagged) {
    const project = projects.find((p) => p.name === name);
    if (!project) {
      problems.push(`${name}@${version}: no such project in packages/*`);
      continue;
    }
    if (project.version !== version) {
      problems.push(
        `${name}@${version}: tag does not match package.json version ${project.version}`,
      );
      continue;
    }
    if (project.private) continue;
    if (registry.has(name, version)) {
      alreadyPublished.push({ name, version });
      continue;
    }
    const latest = registry.latest(name);
    if (latest && compareVersions(version, latest) <= 0) {
      problems.push(
        `${name}@${version}: not greater than the latest published version (${latest})`,
      );
      continue;
    }
    toPublish.push(project);
  }
  if (problems.length) {
    throw new Error(`Cannot release:\n- ${problems.join('\n- ')}`);
  }
  return {
    tagged: [...tagged.keys()].sort(),
    publish: sortTopologically(toPublish).map(({ name, version, dir }) => ({
      name,
      version,
      dir,
    })),
    alreadyPublished,
  };
}

/** A {@link Registry} backed by `npm view`. */
export const npmRegistry: Registry = {
  latest(name) {
    return npmView([name, 'version']);
  },
  has(name, version) {
    return npmView([`${name}@${version}`, 'version']) === version;
  },
};

function npmView(args: string[]): string | undefined {
  try {
    const out = run('npm', ['view', ...args, '--json']);
    if (!out) return undefined; // No matching version
    const parsed = JSON.parse(out) as unknown;
    return typeof parsed === 'string' ? parsed : undefined;
  } catch (err) {
    const message = String((err as { stdout?: string }).stdout || err);
    if (message.includes('E404')) return undefined;
    throw err;
  }
}

/**
 * Build a pnpm `--filter` list selecting the packages
 * (and their dependencies, if `withDependencies` is true).
 */
export function pnpmFilters(names: string[], withDependencies = true): string {
  const suffix = withDependencies ? '...' : '';
  return names.map((n) => `--filter=${n}${suffix}`).join(' ');
}
