import { bumpFromCommits, commitTouchesDir } from './commits.mts';
import type { GitCommit, VersionTag } from './git.mts';
import { parseVersionTag } from './git.mts';
import type { Bump } from './semver.mts';
import { compareVersions, incrementVersion } from './semver.mts';
import type { Project } from './workspace.mts';
import { internalDependencies } from './workspace.mts';

export interface PlannedBump {
  project: Project;
  from: string;
  to: string;
  bump: Bump;
  /** Why the project is being bumped */
  reason: 'commits' | 'dependency';
  /** For `dependency` bumps, which bumped dependencies caused it */
  causedBy?: string[];
}

/** Map of project name to its highest tagged version. */
export function latestTaggedVersions(tags: VersionTag[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const { name, version } of tags) {
    const current = latest.get(name);
    if (!current || compareVersions(version, current) > 0) {
      latest.set(name, version);
    }
  }
  return latest;
}

/**
 * Commits that affect `project` since its last release: walk the history
 * (newest first) keeping commits that touch the project's directory,
 * stopping at (and including) the first commit carrying any version tag
 * for the project.
 */
export function commitsSinceRelease(
  project: Pick<Project, 'name' | 'dir'>,
  commits: GitCommit[],
): GitCommit[] {
  const kept: GitCommit[] = [];
  for (const commit of commits) {
    if (commitTouchesDir(commit, project.dir)) kept.push(commit);
    const isReleaseCommit = commit.tags.some(
      (tag) => parseVersionTag(tag)?.name === project.name,
    );
    if (isReleaseCommit) break;
  }
  return kept;
}

/**
 * Throw if any project's manifest version is *lower* than its latest
 * version tag (e.g. a merge clobbered a newer version with an older one).
 */
export function assertNoVersionRegressions(
  projects: Pick<Project, 'name' | 'version'>[],
  latestTags: Map<string, string>,
): void {
  const problems: string[] = [];
  for (const project of projects) {
    const tagged = latestTags.get(project.name);
    if (tagged && compareVersions(project.version, tagged) < 0) {
      problems.push(
        `${project.name}: package.json has ${project.version} but the latest tag is ${project.name}@${tagged}`,
      );
    }
  }
  if (problems.length) {
    throw new Error(
      `Version regressions found (did a merge overwrite a newer version?):\n- ${problems.join('\n- ')}`,
    );
  }
}

/**
 * Determine which projects need a version bump, and to what.
 *
 * @param projects Projects sorted so dependencies come before dependents.
 * @param commits All commits, newest first.
 */
export function computeBumps(
  projects: Project[],
  commits: GitCommit[],
): PlannedBump[] {
  const names = new Set(projects.map((p) => p.name));
  const bumps: PlannedBump[] = [];
  const bumped = new Set<string>();
  for (const project of projects) {
    const own = bumpFromCommits(commitsSinceRelease(project, commits));
    if (own) {
      bumps.push({
        project,
        from: project.version,
        to: incrementVersion(project.version, own),
        bump: own,
        reason: 'commits',
      });
      bumped.add(project.name);
      continue;
    }
    const causedBy = internalDependencies(project, names).filter((d) =>
      bumped.has(d),
    );
    if (causedBy.length) {
      bumps.push({
        project,
        from: project.version,
        to: incrementVersion(project.version, 'patch'),
        bump: 'patch',
        reason: 'dependency',
        causedBy,
      });
      bumped.add(project.name);
    }
  }
  return bumps;
}
