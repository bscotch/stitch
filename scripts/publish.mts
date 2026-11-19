/**
 * CI: publish packages to npm, in the order given.
 *
 * Each package is packed with pnpm (which replaces `workspace:` protocol
 * versions with real ones), then the tarball is published with npm, which
 * handles npm Trusted Publishing (OIDC) authentication in GitHub Actions.
 *
 * Usage: node scripts/publish.mts [--dry-run] <name> [<name> ...]
 *    or: node scripts/publish.mts [--dry-run] --json '["name", ...]'
 */
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { run } from './lib/exec.mts';
import { repoRoot } from './lib/git.mts';
import { npmRegistry } from './lib/release.mts';
import { loadProjects } from './lib/workspace.mts';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    json: { type: 'string' },
  },
});
const dryRun = args['dry-run'];
const names: string[] = args.json
  ? (JSON.parse(args.json) as string[])
  : positionals;

if (!names.length) {
  console.log('Nothing to publish.');
  process.exit(0);
}

const root = repoRoot();
const projects = loadProjects(root);
const isCi = !!process.env.GITHUB_ACTIONS;

for (const name of names) {
  const project = projects.find((p) => p.name === name);
  if (!project) throw new Error(`No project named ${name}`);
  if (project.private) throw new Error(`${name} is private`);
  const id = `${name}@${project.version}`;

  if (npmRegistry.has(name, project.version)) {
    console.log(`\n${id} is already published; skipping.`);
    continue;
  }

  console.log(`\n=== Publishing ${id} ${dryRun ? '(dry run)' : ''}`);
  const packDir = mkdtempSync(join(tmpdir(), 'stitch-pack-'));
  try {
    run('pnpm', ['pack', '--pack-destination', packDir], {
      cwd: join(root, project.dir),
      inherit: true,
    });
    const tarballs = readdirSync(packDir).filter((f) => f.endsWith('.tgz'));
    if (tarballs.length !== 1) {
      throw new Error(`Expected one tarball for ${id}, found: ${tarballs}`);
    }
    const publishArgs = [
      'publish',
      join(packDir, tarballs[0]),
      '--access',
      'public',
    ];
    if (isCi) publishArgs.push('--provenance');
    if (dryRun) publishArgs.push('--dry-run');
    run('npm', publishArgs, { inherit: true });
  } finally {
    rmSync(packDir, { recursive: true, force: true });
  }
}
console.log('\n✔ Publishing complete.');
