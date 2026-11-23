/**
 * CI: figure out what a push to the release branch needs to publish.
 *
 * Finds `<name>@<version>` tags on the pushed commits (created by
 * `pnpm bump`) and decides which public packages need publishing to npm.
 * Writes results to `$GITHUB_OUTPUT` when available.
 *
 * Usage:
 *   node scripts/release-plan.mts --before <sha> --after <sha>   # a push
 *   node scripts/release-plan.mts --ref <commit-ish>             # a retry
 *
 * With `--ref`, the newest bump commit at or before `<commit-ish>` (along
 * first parents) is released, but using the code at `<commit-ish>`. That way
 * a failed release can be retried after pushing fixes, without re-bumping.
 */
import { appendFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  git,
  parseVersionTag,
  readFileAt,
  repoRoot,
  tagsPointingAt,
  type VersionTag,
} from './lib/git.mts';
import { npmRegistry, planRelease, pnpmFilters } from './lib/release.mts';
import type { PackageManifest, Project } from './lib/workspace.mts';

const { values: args } = parseArgs({
  options: {
    before: { type: 'string' },
    after: { type: 'string' },
    ref: { type: 'string' },
  },
});

const root = repoRoot();

function isCommit(ref: string | undefined): ref is string {
  if (!ref || /^0+$/.test(ref)) return false;
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root);
    return true;
  } catch {
    return false;
  }
}

/** Commits to inspect, newest first. */
function listCandidateCommits(): string[] {
  if (args.ref) {
    return git(['rev-list', '--first-parent', `${args.ref}^{commit}`], root)
      .split(/\r?\n/)
      .filter(Boolean);
  }
  const after = args.after || 'HEAD';
  if (isCommit(args.before)) {
    return git(['rev-list', `${args.before}..${after}`], root)
      .split(/\r?\n/)
      .filter(Boolean);
  }
  return [git(['rev-parse', `${after}^{commit}`], root)];
}

/** Load the `packages/*` manifests as they exist at `ref`. */
function loadProjectsAt(ref: string): Project[] {
  const dirs = git(['ls-tree', '-d', '--name-only', ref, 'packages/'], root)
    .split(/\r?\n/)
    .filter(Boolean);
  const projects: Project[] = [];
  for (const dir of dirs) {
    const raw = readFileAt(ref, `${dir}/package.json`, root);
    if (!raw) continue;
    const manifest = JSON.parse(raw) as PackageManifest;
    projects.push({
      name: manifest.name,
      version: manifest.version,
      dir,
      private: !!manifest.private,
      manifestPath: `${root}/${dir}/package.json`,
      manifest,
    });
  }
  return projects;
}

function setOutputs(outputs: Record<string, string>) {
  console.log('\nOutputs:');
  for (const [key, value] of Object.entries(outputs)) {
    console.log(`  ${key}=${value}`);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    }
  }
}

function summarize(markdown: string) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
}

// Find the newest commit carrying version tags; that's what gets released.
let releaseRef: string | undefined;
let tags: VersionTag[] = [];
for (const commit of listCandidateCommits()) {
  const found = tagsPointingAt(commit, root)
    .map(parseVersionTag)
    .filter((t): t is VersionTag => !!t);
  if (found.length) {
    releaseRef = commit;
    tags = found;
    break;
  }
}

if (!releaseRef) {
  console.log(
    'No version tags found on the pushed commits. Nothing to release.',
  );
  setOutputs({
    ref: '',
    tagged: '[]',
    publish: '[]',
    filters: '',
    has_publish: 'false',
  });
  process.exit(0);
}

// The commit to test, build, and publish. Normally the bump commit itself,
// but a retry can use a later commit (e.g. with CI fixes).
const buildRef = args.ref
  ? git(['rev-parse', `${args.ref}^{commit}`], root)
  : releaseRef;

console.log(`Bump commit: ${releaseRef}`);
if (buildRef !== releaseRef) console.log(`Building from: ${buildRef}`);
console.log(`Tags: ${tags.map((t) => t.tag).join(', ')}`);

let plan;
try {
  // Tags must still match the manifests at the build commit, so a retry from
  // a later commit can't publish anything the bump didn't version.
  plan = planRelease(tags, loadProjectsAt(buildRef), npmRegistry);
} catch (err) {
  console.error(`\n✖ ${(err as Error).message}`);
  summarize(
    `### ❌ Release blocked\n\n\`\`\`\n${(err as Error).message}\n\`\`\``,
  );
  process.exit(1);
}

for (const { name, version } of plan.alreadyPublished) {
  console.log(`Skipping ${name}@${version} (already on npm)`);
}
const names = plan.publish.map((p) => p.name);
console.log(
  names.length
    ? `To publish (in order):\n- ${plan.publish.map((p) => `${p.name}@${p.version}`).join('\n- ')}`
    : 'Nothing to publish to npm.',
);
summarize(
  [
    `### Release ${releaseRef.slice(0, 8)}${buildRef !== releaseRef ? ` (built from ${buildRef.slice(0, 8)})` : ''}`,
    `**Tagged:** ${plan.tagged.join(', ')}`,
    `**npm:** ${names.length ? plan.publish.map((p) => `\`${p.name}@${p.version}\``).join(', ') : 'nothing to publish'}`,
  ].join('\n\n'),
);

setOutputs({
  ref: buildRef,
  tagged: JSON.stringify(plan.tagged),
  publish: JSON.stringify(names),
  filters: pnpmFilters(names),
  has_publish: String(names.length > 0),
});
