import type { GitCommit } from './git.mts';
import type { Bump } from './semver.mts';
import { maxBump } from './semver.mts';

/**
 * Commit-type labels and the version bump each implies.
 * Types not listed here (chore, test, refactor, build, ci, ...) imply no bump.
 */
export const CHANGE_TYPES: readonly {
  labels: readonly string[];
  bump: Bump;
}[] = [
  { labels: ['feature', 'feat', '✨', '🆕'], bump: 'minor' },
  {
    labels: ['alt', 'alteration', 'change', 'breaking', '🧨', '💣'],
    bump: 'major',
  },
  {
    labels: [
      'fix',
      'bug',
      'bugfix',
      'issue',
      '🐛',
      '🐞',
      '🧯',
      '🚒',
      '⚕',
      '💉',
      '🩹',
    ],
    bump: 'patch',
  },
  {
    labels: ['docs', 'doc', 'documentation', '📚', '📙', '📃', '📜', '📄'],
    bump: 'patch',
  },
  { labels: ['security', '🔒', '🔐'], bump: 'patch' },
  { labels: ['performance', 'perf', '🚀'], bump: 'patch' },
];

export interface Change {
  type: string;
  scope?: string;
  breaking: boolean;
  title: string;
  bump?: Bump;
}

const changePattern =
  /^(?<type>[^\s:(!]+)(\(\s*(?<scope>[^)]*)\s*\))?(?<breaking>!)?: (?<title>.+)/su;

/** Split a commit message into blank-line-separated paragraphs. */
export function paragraphs(message: string): string[] {
  return message.trim().split(/(?:\r?\n){2,}/g);
}

/**
 * Parse a commit message into its conventional-commit changes. Every
 * paragraph starting with `type(scope)!: title` is a separate change.
 */
export function parseChanges(message: string): Change[] {
  const changes: Change[] = [];
  for (const paragraph of paragraphs(message)) {
    const header = paragraph.match(changePattern)?.groups;
    if (!header) continue;
    const config = CHANGE_TYPES.find((c) => c.labels.includes(header.type));
    const breaking = !!header.breaking;
    changes.push({
      type: header.type,
      scope: header.scope || undefined,
      breaking,
      title: header.title,
      bump: breaking ? 'major' : config?.bump,
    });
  }
  return changes;
}

/** The bump implied by a set of commits. */
export function bumpFromCommits(commits: GitCommit[]): Bump | undefined {
  return maxBump(
    commits.flatMap((commit) => parseChanges(commit.body).map((c) => c.bump)),
  );
}

/** Whether `file` is inside the repo-relative directory `dir`. */
export function isInDir(file: string, dir: string): boolean {
  return file.startsWith(`${dir}/`);
}

export function commitTouchesDir(commit: GitCommit, dir: string): boolean {
  return commit.files.some((file) => isInDir(file, dir));
}
