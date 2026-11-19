import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commit, project } from './fixtures.test-utils.mts';
import {
  assertNoVersionRegressions,
  commitsSinceRelease,
  computeBumps,
  latestTaggedVersions,
} from './versioning.mts';
import { sortTopologically } from './workspace.mts';

describe('versioning', () => {
  it('finds the latest tagged version per project', () => {
    const latest = latestTaggedVersions([
      { tag: 'a@1.9.0', name: 'a', version: '1.9.0' },
      { tag: 'a@1.10.0', name: 'a', version: '1.10.0' },
      { tag: '@s/b@0.1.0', name: '@s/b', version: '0.1.0' },
    ]);
    assert.equal(latest.get('a'), '1.10.0');
    assert.equal(latest.get('@s/b'), '0.1.0');
  });

  it('collects commits since the last release tag (inclusive)', () => {
    const yy = project('@bscotch/yy', '1.0.0');
    const commits = [
      commit('fix: new', ['packages/yy/a.ts']),
      commit('feat: other project', ['packages/parser/a.ts']),
      commit('bumped: @bscotch/yy@1.0.0', ['packages/yy/package.json'], {
        tags: ['@bscotch/yy@1.0.0'],
      }),
      commit('feat: old', ['packages/yy/a.ts']),
    ];
    assert.deepEqual(
      commitsSinceRelease(yy, commits).map((c) => c.body),
      ['fix: new', 'bumped: @bscotch/yy@1.0.0'],
    );
  });

  it('stops at a release tag even if that commit does not touch the project', () => {
    const yy = project('@bscotch/yy', '1.0.0');
    const commits = [
      commit('fix: new', ['packages/yy/a.ts']),
      commit('chore: changelogs', ['packages/other/CHANGELOG.md'], {
        tags: ['@bscotch/yy@1.0.0'],
      }),
      commit('feat: old', ['packages/yy/a.ts']),
    ];
    assert.deepEqual(
      commitsSinceRelease(yy, commits).map((c) => c.body),
      ['fix: new'],
    );
  });

  it('bumps changed projects and cascades patches to dependents', () => {
    const yy = project('@bscotch/yy', '2.7.0');
    const parser = project('@bscotch/gml-parser', '1.17.2', {
      deps: ['@bscotch/yy'],
    });
    const vscode = project('bscotch-stitch-vscode', '1.81.0', {
      private: true,
      devDeps: ['@bscotch/gml-parser'],
    });
    const unrelated = project('@bscotch/steam-bbcode', '0.4.0');
    const projects = sortTopologically([vscode, unrelated, parser, yy]);
    const tags = [
      '@bscotch/yy@2.7.0',
      '@bscotch/gml-parser@1.17.2',
      'bscotch-stitch-vscode@1.81.0',
      '@bscotch/steam-bbcode@0.4.0',
    ];
    const commits = [
      commit('feat: yy feature', ['packages/yy/src/a.ts']),
      commit('chore: tidy', ['packages/steam-bbcode/src/a.ts']),
      commit('bumped: everything', ['package.json'], { tags }),
    ];
    const bumps = computeBumps(projects, commits);
    assert.deepEqual(
      bumps.map((b) => [b.project.name, b.from, b.to, b.reason, b.causedBy]),
      [
        ['@bscotch/yy', '2.7.0', '2.8.0', 'commits', undefined],
        [
          '@bscotch/gml-parser',
          '1.17.2',
          '1.17.3',
          'dependency',
          ['@bscotch/yy'],
        ],
        [
          'bscotch-stitch-vscode',
          '1.81.0',
          '1.81.1',
          'dependency',
          ['@bscotch/gml-parser'],
        ],
      ],
    );
  });

  it("prefers a project's own bump over a dependency cascade", () => {
    const yy = project('@bscotch/yy', '2.7.0');
    const parser = project('@bscotch/gml-parser', '1.17.2', {
      dir: 'packages/parser',
      deps: ['@bscotch/yy'],
    });
    const commits = [
      commit('fix: yy', ['packages/yy/a.ts']),
      commit('feat: parser', ['packages/parser/a.ts']),
    ];
    const bumps = computeBumps(sortTopologically([parser, yy]), commits);
    assert.deepEqual(
      bumps.map((b) => [b.project.name, b.to, b.reason]),
      [
        ['@bscotch/yy', '2.7.1', 'commits'],
        ['@bscotch/gml-parser', '1.18.0', 'commits'],
      ],
    );
  });

  it('detects version regressions', () => {
    const latest = new Map([['a', '1.2.0']]);
    assert.doesNotThrow(() =>
      assertNoVersionRegressions([{ name: 'a', version: '1.2.0' }], latest),
    );
    assert.doesNotThrow(() =>
      assertNoVersionRegressions([{ name: 'b', version: '0.0.1' }], latest),
    );
    assert.throws(
      () =>
        assertNoVersionRegressions([{ name: 'a', version: '1.1.9' }], latest),
      /a: package.json has 1.1.9 but the latest tag is a@1.2.0/,
    );
  });
});
