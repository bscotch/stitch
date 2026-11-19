import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { project } from './fixtures.test-utils.mts';
import { parseVersionTag, type VersionTag } from './git.mts';
import { planRelease, pnpmFilters, type Registry } from './release.mts';

function tags(...raw: string[]): VersionTag[] {
  return raw.map((t) => parseVersionTag(t)!);
}

function fakeRegistry(published: Record<string, string[]>): Registry {
  return {
    latest: (name) => published[name]?.at(-1),
    has: (name, version) => !!published[name]?.includes(version),
  };
}

const yy = project('@bscotch/yy', '2.8.0');
const parser = project('@bscotch/gml-parser', '1.17.3', {
  deps: ['@bscotch/yy'],
});
const vscode = project('bscotch-stitch-vscode', '1.81.1', {
  private: true,
  devDeps: ['@bscotch/gml-parser'],
});
const projects = [vscode, parser, yy];

describe('release planning', () => {
  it('publishes unpublished public packages in dependency order', () => {
    const plan = planRelease(
      tags(
        'bscotch-stitch-vscode@1.81.1',
        '@bscotch/gml-parser@1.17.3',
        '@bscotch/yy@2.8.0',
      ),
      projects,
      fakeRegistry({
        '@bscotch/yy': ['2.7.0'],
        '@bscotch/gml-parser': ['1.17.2'],
      }),
    );
    assert.deepEqual(
      plan.publish.map((p) => p.name),
      ['@bscotch/yy', '@bscotch/gml-parser'],
    );
    assert.deepEqual(plan.tagged, [
      '@bscotch/gml-parser',
      '@bscotch/yy',
      'bscotch-stitch-vscode',
    ]);
    assert.deepEqual(plan.alreadyPublished, []);
  });

  it('skips already-published versions (safe re-runs)', () => {
    const plan = planRelease(
      tags('@bscotch/gml-parser@1.17.3', '@bscotch/yy@2.8.0'),
      projects,
      fakeRegistry({
        '@bscotch/yy': ['2.7.0', '2.8.0'],
        '@bscotch/gml-parser': ['1.17.2'],
      }),
    );
    assert.deepEqual(
      plan.publish.map((p) => p.name),
      ['@bscotch/gml-parser'],
    );
    assert.deepEqual(plan.alreadyPublished, [
      { name: '@bscotch/yy', version: '2.8.0' },
    ]);
  });

  it('publishes brand-new packages', () => {
    const plan = planRelease(
      tags('@bscotch/yy@2.8.0'),
      projects,
      fakeRegistry({}),
    );
    assert.deepEqual(
      plan.publish.map((p) => p.name),
      ['@bscotch/yy'],
    );
  });

  it('refuses versions lower than the latest published (clobber guard)', () => {
    assert.throws(
      () =>
        planRelease(
          tags('@bscotch/yy@2.8.0'),
          projects,
          fakeRegistry({ '@bscotch/yy': ['2.7.0', '2.9.0'] }),
        ),
      /@bscotch\/yy@2.8.0: not greater than the latest published version \(2.9.0\)/,
    );
  });

  it('refuses tags that do not match package.json', () => {
    assert.throws(
      () => planRelease(tags('@bscotch/yy@2.9.0'), projects, fakeRegistry({})),
      /tag does not match package.json version 2.8.0/,
    );
  });

  it('builds pnpm filters', () => {
    assert.equal(pnpmFilters([]), '');
    assert.equal(
      pnpmFilters(['@bscotch/yy', '@bscotch/gml-parser']),
      '--filter=@bscotch/yy... --filter=@bscotch/gml-parser...',
    );
    assert.equal(pnpmFilters(['@bscotch/yy'], false), '--filter=@bscotch/yy');
  });
});
