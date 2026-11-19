import { run, tryRun } from './exec.mts';
import { isValidVersion } from './semver.mts';

export interface GitCommit {
  hash: string;
  /** Author date */
  date: Date;
  /** Tag names pointing at this commit */
  tags: string[];
  /** Full commit message (subject + body) */
  body: string;
  /** Repo-relative, `/`-separated paths of files changed by this commit */
  files: string[];
}

export interface VersionTag {
  tag: string;
  name: string;
  version: string;
}

const RECORD = '\x1e';
const FIELD = '\x1f';

export function git(args: string[], cwd?: string): string {
  return run('git', args, { cwd });
}

export function repoRoot(cwd = process.cwd()): string {
  return git(['rev-parse', '--show-toplevel'], cwd);
}

export function currentBranch(cwd?: string): string {
  return git(['branch', '--show-current'], cwd);
}

export function isClean(cwd?: string): boolean {
  return git(['status', '--porcelain'], cwd) === '';
}

export function normalizePath(path: string): string {
  return path.replace(/\\+/g, '/').replace(/\/$/, '');
}

/** Parse a `name@version` tag (supports scoped names). */
export function parseVersionTag(tag: string): VersionTag | undefined {
  const match = tag.match(/^(?<name>(?:@[^@/]+\/)?[^@]+)@(?<version>[^@]+)$/);
  if (!match?.groups || !isValidVersion(match.groups.version)) return undefined;
  return { tag, name: match.groups.name, version: match.groups.version };
}

/** Parse the raw output of {@link listCommits}'s git-log call. */
export function parseGitLog(raw: string): GitCommit[] {
  const commits: GitCommit[] = [];
  for (const record of raw.split(RECORD)) {
    if (!record.trim()) continue;
    const [hash, date, refs, body, files] = record.split(FIELD);
    commits.push({
      hash,
      date: new Date(date),
      tags: refs
        .split(',')
        .map((ref) => ref.trim())
        .filter((ref) => ref.startsWith('tag: '))
        .map((ref) => ref.slice('tag: '.length)),
      body: body.trim(),
      files: (files || '')
        .split(/\r?\n/)
        .map((f) => f.trim())
        .filter(Boolean)
        .map(normalizePath),
    });
  }
  return commits;
}

/**
 * List all commits reachable from `ref`, newest first (topological order).
 *
 * Merge commits list the files they changed relative to their first parent,
 * so a conventional-commit merge message (e.g. a squash-less GitHub PR
 * merge) is attributed to the files it brought in.
 */
export function listCommits(ref = 'HEAD', cwd?: string): GitCommit[] {
  const raw = git(
    [
      'log',
      '--topo-order',
      '--no-renames',
      '--diff-merges=first-parent',
      '--name-only',
      `--format=${RECORD}%H${FIELD}%aI${FIELD}%D${FIELD}%B${FIELD}`,
      ref,
      '--',
    ],
    cwd,
  );
  return parseGitLog(raw);
}

/** All `name@version` tags reachable from `ref`. */
export function listVersionTags(ref = 'HEAD', cwd?: string): VersionTag[] {
  return git(['tag', '--list', '--merged', ref], cwd)
    .split(/\r?\n/)
    .map((t) => parseVersionTag(t.trim()))
    .filter((t): t is VersionTag => !!t);
}

/** Tags pointing at the given commit-ish. */
export function tagsPointingAt(ref: string, cwd?: string): string[] {
  return git(['tag', '--points-at', ref], cwd)
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Read a file's contents at a given commit-ish. */
export function readFileAt(
  ref: string,
  path: string,
  cwd?: string,
): string | undefined {
  return tryRun('git', ['show', `${ref}:${normalizePath(path)}`], { cwd });
}
