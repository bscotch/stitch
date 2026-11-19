/**
 * Regenerate every project's CHANGELOG.md from the git history.
 * (`pnpm bump` does this automatically; this is for previewing/repairing.)
 */
import { relative } from 'node:path';
import { writeChangelogs } from './lib/changelog.mts';
import { listCommits, repoRoot } from './lib/git.mts';
import { loadProjects } from './lib/workspace.mts';

const root = repoRoot();
const changed = writeChangelogs(loadProjects(root), listCommits('HEAD', root));
console.log(
  changed.length
    ? `Updated:\n- ${changed.map((p) => relative(root, p)).join('\n- ')}`
    : 'All changelogs are up to date.',
);
