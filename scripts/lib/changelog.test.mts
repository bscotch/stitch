import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectChangelog, renderChangelog } from './changelog.mts';
import { commit, project } from './fixtures.test-utils.mts';

const dir = ['packages/yy/src/a.ts'];

describe('changelog', () => {
  it('assigns commits to versions using tags, newest first', () => {
    const yy = project('@bscotch/yy', '1.1.0');
    const commits = [
      commit('chore: changelog', ['packages/yy/CHANGELOG.md'], {
        tags: ['@bscotch/yy@1.1.0'],
        date: '2026-02-02T00:00:00Z',
      }),
      commit('feat: Second', dir, { date: '2026-02-01T00:00:00Z' }),
      commit('fix: First fix', dir, {
        tags: ['@bscotch/yy@1.0.0'],
        date: '2026-01-02T00:00:00Z',
      }),
      commit('feat: First', dir, { date: '2026-01-01T00:00:00Z' }),
    ];
    const versions = collectChangelog(yy, commits);
    assert.deepEqual(
      versions.map((v) => [v.version, v.date.toISOString(), v.groups]),
      [
        ['1.1.0', '2026-02-01T00:00:00.000Z', { Features: ['Second'] }],
        [
          '1.0.0',
          '2026-01-02T00:00:00.000Z',
          { Fixes: ['First fix'], Features: ['First'] },
        ],
      ],
    );
  });

  it('assigns untagged commits to a bumped (not yet tagged) manifest version', () => {
    const yy = project('@bscotch/yy', '1.0.1');
    const commits = [
      commit('fix: Unreleased fix', dir),
      commit('feat: Released', dir, { tags: ['@bscotch/yy@1.0.0'] }),
    ];
    assert.deepEqual(
      collectChangelog(yy, commits).map((v) => [v.version, v.groups]),
      [
        ['1.0.1', { Fixes: ['Unreleased fix'] }],
        ['1.0.0', { Features: ['Released'] }],
      ],
    );
  });

  it('skips unreleased commits when the manifest has not been bumped', () => {
    const yy = project('@bscotch/yy', '1.0.0');
    const commits = [
      commit('fix: Unreleased fix', dir),
      commit('feat: Released', dir, { tags: ['@bscotch/yy@1.0.0'] }),
    ];
    assert.deepEqual(
      collectChangelog(yy, commits).map((v) => v.version),
      ['1.0.0'],
    );
  });

  it("uses tags on commits that don't touch the project", () => {
    const yy = project('@bscotch/yy', '1.0.0');
    const commits = [
      commit('fix: Unreleased fix', dir),
      commit('chore: other changelog', ['packages/other/CHANGELOG.md'], {
        tags: ['@bscotch/yy@1.0.0'],
      }),
      commit('fix: Released fix', dir),
    ];
    assert.deepEqual(
      collectChangelog(yy, commits).map((v) => [v.version, v.groups]),
      [['1.0.0', { Fixes: ['Released fix'] }]],
    );
  });

  it('only includes Fixes, Features, and Docs', () => {
    const yy = project('@bscotch/yy', '1.0.0');
    const commits = [
      commit(
        'chore: nope\n\nfeat: Yes\n\ndocs: Documented\n\ntest: nope\n\nbugfix: Bug',
        dir,
      ),
    ];
    assert.deepEqual(collectChangelog(yy, commits)[0].groups, {
      Features: ['Yes'],
      Docs: ['Documented'],
      Fixes: ['Bug'],
    });
  });

  it('renders markdown', () => {
    const yy = project('@bscotch/yy', '1.0.0', { displayName: 'Yy Tools' });
    const rendered = renderChangelog(yy, [
      {
        version: '1.0.0',
        date: new Date('2026-01-05T12:00:00Z'),
        groups: { Fixes: ['B', 'C'], Features: ['A'] },
      },
    ]);
    assert.equal(
      rendered,
      '# Yy Tools Changelog\n\n## 1.0.0 (2026-01-05)\n\n### Features\n\n- A\n\n### Fixes\n\n- B\n- C',
    );
  });
});
