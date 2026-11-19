/**
 * Version-bump every project that has changed since its last release,
 * regenerate changelogs, commit, tag, and push. Publishing happens in CI
 * (see `.github/workflows/release.yaml`), triggered by the push.
 *
 * Usage: `pnpm bump [--dry-run]`
 *
 * Bump levels are inferred from conventional-commit messages since each
 * project's latest `<name>@<version>` tag. Projects whose workspace
 * dependencies were bumped get at least a patch bump.
 */
import { relative } from 'node:path';
import {
  collectChangelog,
  renderChangelog,
  writeChangelogs,
} from './lib/changelog.mts';
import {
  currentBranch,
  git,
  isClean,
  listCommits,
  listVersionTags,
  repoRoot,
} from './lib/git.mts';
import {
  assertNoVersionRegressions,
  computeBumps,
  latestTaggedVersions,
  type PlannedBump,
} from './lib/versioning.mts';
import { loadProjects, writeProjectVersion } from './lib/workspace.mts';

const RELEASE_BRANCH = 'develop';
const REMOTE = 'origin';

const dryRun = process.argv.includes('--dry-run');
const root = repoRoot();

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function printPlan(bumps: PlannedBump[]) {
  const rows = bumps.map((b) => ({
    project: b.project.name,
    from: b.from,
    to: b.to,
    bump: b.bump,
    reason:
      b.reason === 'dependency'
        ? `dependency (${b.causedBy!.join(', ')})`
        : 'commits',
    publish: b.project.private ? '' : 'npm',
  }));
  console.table(rows);
}

// PREFLIGHT
const branch = currentBranch(root);
if (!dryRun) {
  if (branch !== RELEASE_BRANCH) {
    fail(
      `Bumping must happen on "${RELEASE_BRANCH}" (currently on "${branch || 'detached HEAD'}"). Use --dry-run to preview.`,
    );
  }
  if (!isClean(root)) {
    fail('The working tree must be clean before bumping.');
  }
  console.log('Pulling latest commits and tags...');
  git(['pull', '--rebase', '--tags', REMOTE, RELEASE_BRANCH], root);
} else {
  console.log(
    `DRY RUN on "${branch || 'detached HEAD'}" (using local commits and tags; nothing will be written)`,
  );
}

const projects = loadProjects(root);
const commits = listCommits('HEAD', root);
const latestTags = latestTaggedVersions(listVersionTags('HEAD', root));

try {
  assertNoVersionRegressions(projects, latestTags);
} catch (err) {
  fail((err as Error).message);
}

// PLAN
const bumps = computeBumps(projects, commits);
if (!bumps.length) {
  console.log('\nNo projects have changes requiring a version bump.');
  process.exit(0);
}
printPlan(bumps);

if (dryRun) {
  for (const bump of bumps) {
    const project = { ...bump.project, version: bump.to };
    const [latest] = collectChangelog(project, commits);
    const preview =
      latest?.version === bump.to
        ? renderChangelog(project, [latest]).split('\n').slice(2).join('\n')
        : '(no changelog entries)';
    console.log(`\n--- ${bump.project.name} ---\n${preview}`);
  }
  process.exit(0);
}

// WRITE: versions, then changelogs (which assign untagged commits to the new versions)
for (const bump of bumps) {
  writeProjectVersion(bump.project, bump.to);
}
const changedChangelogs = writeChangelogs(projects, commits);

// COMMIT + TAG
const toAdd = [
  ...bumps.map((b) => b.project.manifestPath),
  ...changedChangelogs,
].map((p) => relative(root, p));
git(['add', '--', ...toAdd], root);
const tags = bumps.map((b) => `${b.project.name}@${b.to}`);
git(['commit', '-m', `bumped: ${tags.join(', ')}`], root);
for (const tag of tags) {
  git(['tag', '-a', tag, '-m', 'Bumped the version'], root);
}

// PUSH (atomically, so CI sees the commit and all of its tags in a single push)
console.log(`\nPushing ${RELEASE_BRANCH} with tags: ${tags.join(', ')}`);
git(['push', '--atomic', '--follow-tags', REMOTE, RELEASE_BRANCH], root);
console.log('\n✔ Done! CI will build, test, and publish the bumped packages.');
