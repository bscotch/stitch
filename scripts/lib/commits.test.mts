import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bumpFromCommits, commitTouchesDir, parseChanges } from './commits.mts';
import { commit } from './fixtures.test-utils.mts';

describe('commits', () => {
  it('parses a simple conventional commit', () => {
    assert.deepEqual(parseChanges('fix: Fixed a thing'), [
      {
        type: 'fix',
        scope: undefined,
        breaking: false,
        title: 'Fixed a thing',
        bump: 'patch',
      },
    ]);
  });

  it('parses scopes and breaking markers', () => {
    const [change] = parseChanges('feat(parser)!: Changed the API');
    assert.equal(change.type, 'feat');
    assert.equal(change.scope, 'parser');
    assert.equal(change.breaking, true);
    assert.equal(change.bump, 'major');
  });

  it('parses multiple changes from paragraphs, ignoring body text', () => {
    const changes = parseChanges(
      'feat: Added X\n\nSome details\nabout X\n\nfix: Fixed Y\r\n\r\ndocs: Documented Z',
    );
    assert.deepEqual(
      changes.map((c) => [c.type, c.title, c.bump]),
      [
        ['feat', 'Added X', 'minor'],
        ['fix', 'Fixed Y', 'patch'],
        ['docs', 'Documented Z', 'patch'],
      ],
    );
  });

  it('maps types to bumps', () => {
    const bump = (msg: string) => parseChanges(msg)[0]?.bump;
    assert.equal(bump('feature: x'), 'minor');
    assert.equal(bump('change: x'), 'major');
    assert.equal(bump('🐛: x'), 'patch');
    assert.equal(bump('perf: x'), 'patch');
    assert.equal(bump('security: x'), 'patch');
    assert.equal(bump('chore: x'), undefined);
    assert.equal(bump('refactor: x'), undefined);
    assert.equal(bump('bumped: @bscotch/yy@1.0.0'), undefined);
    assert.equal(bump('Merge pull request #1 from x/y'), undefined);
  });

  it('computes the max bump across commits', () => {
    assert.equal(bumpFromCommits([]), undefined);
    assert.equal(
      bumpFromCommits([
        commit('fix: a', []),
        commit('chore: b', []),
        commit('feat: c\n\nfix: d', []),
      ]),
      'minor',
    );
  });

  it('checks whether a commit touches a directory', () => {
    const c = commit('fix: a', ['packages/vscode/webviews/src/x.ts']);
    assert.ok(commitTouchesDir(c, 'packages/vscode'));
    assert.ok(!commitTouchesDir(c, 'packages/vs'));
    assert.ok(!commitTouchesDir(c, 'packages/yy'));
  });
});
