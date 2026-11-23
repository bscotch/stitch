import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Change } from './commits.mts';
import { commitTouchesDir, parseChanges } from './commits.mts';
import type { GitCommit } from './git.mts';
import { parseVersionTag } from './git.mts';
import { compareVersions } from './semver.mts';
import type { Project } from './workspace.mts';

/**
 * Which commit types appear in changelogs, and under which heading.
 * Any change marked breaking with `!` goes under {@link BREAKING_GROUP}
 * regardless of its type.
 */
export const CHANGELOG_GROUPS: readonly {
  types: readonly string[];
  group: string;
}[] = [
  {
    types: ['breaking', 'change', 'alt', 'alteration', '🧨', '💣'],
    group: 'Breaking Changes',
  },
  { types: ['feat', 'feature', '✨', '🆕'], group: 'Features' },
  {
    types: [
      'fix',
      'bug',
      'bugfix',
      'issue',
      'perf',
      'performance',
      'security',
      '🐛',
      '🐞',
      '🧯',
      '🚒',
      '⚕',
      '💉',
      '🩹',
      '🚀',
      '🔒',
      '🔐',
    ],
    group: 'Fixes',
  },
  {
    types: ['docs', 'doc', 'documentation', '📚', '📙', '📃', '📜', '📄'],
    group: 'Docs',
  },
];

const BREAKING_GROUP = CHANGELOG_GROUPS[0].group;

/** The changelog heading for a change, if it belongs in the changelog. */
export function changelogGroup(change: Change): string | undefined {
  if (change.breaking) return BREAKING_GROUP;
  return CHANGELOG_GROUPS.find((g) => g.types.includes(change.type))?.group;
}

/** Collapse a (possibly hard-wrapped) change title onto one line. */
function oneLine(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, ' ').trim();
}

export interface ChangelogVersion {
  version: string;
  /** Date of the newest change in this version */
  date: Date;
  /** Change descriptions keyed by group heading */
  groups: Record<string, string[]>;
}

/** Find `project`'s version in a commit's tags, if it has one. */
function taggedVersion(
  commit: GitCommit,
  projectName: string,
): string | undefined {
  for (const tag of commit.tags) {
    const parsed = parseVersionTag(tag);
    if (parsed?.name === projectName) return parsed.version;
  }
  return undefined;
}

/**
 * Collect a project's changelog from the git history.
 *
 * Commits are assigned to versions using the project's version tags.
 * Commits newer than the latest tag are assigned to the manifest version
 * if it is greater than that tag (i.e. it has been bumped but not yet
 * tagged), otherwise they are treated as unreleased and skipped.
 *
 * @param commits All commits, newest first.
 */
export function collectChangelog(
  project: Pick<Project, 'name' | 'version' | 'dir'>,
  commits: GitCommit[],
): ChangelogVersion[] {
  // Note: version tags are tracked across *all* commits, since a project's
  // tag can land on a commit that doesn't touch the project's files.
  let version: string | undefined;
  const newestTagged = commits
    .map((c) => taggedVersion(c, project.name))
    .find((v) => v);
  if (!newestTagged || compareVersions(project.version, newestTagged) > 0) {
    version = project.version;
  }

  const versions: ChangelogVersion[] = [];
  for (const log of commits) {
    const tagged = taggedVersion(log, project.name);
    if (tagged && (!version || compareVersions(tagged, version) < 0)) {
      version = tagged;
    }
    if (!version) continue; // Unreleased
    if (!commitTouchesDir(log, project.dir)) continue;

    for (const change of parseChanges(log.body)) {
      const group = changelogGroup(change);
      if (!group) continue;
      let section = versions.find((v) => v.version === version);
      if (!section) {
        section = { version, date: log.date, groups: {} };
        versions.push(section);
      } else if (log.date > section.date) {
        section.date = log.date;
      }
      (section.groups[group] ||= []).push(oneLine(change.title));
    }
  }
  return versions.sort((a, b) => compareVersions(b.version, a.version));
}

export function renderChangelog(
  project: Pick<Project, 'name' | 'manifest'>,
  versions: ChangelogVersion[],
): string {
  const title = `# ${project.manifest.displayName || project.name} Changelog`;
  const versionStrings = versions.map((version) => {
    const header = `## ${version.version} (${
      version.date.toISOString().split('T')[0]
    })`;
    const sections = Object.keys(version.groups)
      .sort()
      .map((group) => {
        const changes = version.groups[group]
          .map((description) => `- ${description}`)
          .join('\n');
        return `### ${group}\n\n${changes}`;
      });
    return `${header}\n\n${sections.join('\n\n')}`;
  });
  return `${title}\n\n${versionStrings.join('\n\n')}`;
}

export function changelogPath(project: Pick<Project, 'manifestPath'>): string {
  return join(dirname(project.manifestPath), 'CHANGELOG.md');
}

/**
 * Regenerate every project's CHANGELOG.md.
 * @returns Paths of the files whose content changed.
 */
export function writeChangelogs(
  projects: Project[],
  commits: GitCommit[],
): string[] {
  const changed: string[] = [];
  for (const project of projects) {
    const path = changelogPath(project);
    const content = renderChangelog(
      project,
      collectChangelog(project, commits),
    );
    let existing: string | undefined;
    try {
      existing = readFileSync(path, 'utf8');
    } catch {
      // New changelog
    }
    if (existing !== content) {
      writeFileSync(path, content);
      changed.push(path);
    }
  }
  return changed;
}
