import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseGitLog, parseVersionTag } from './git.mts';
import { project } from './fixtures.test-utils.mts';
import { sortTopologically } from './workspace.mts';

describe('git parsing', () => {
  it('parses version tags', () => {
    assert.deepEqual(parseVersionTag('@bscotch/yy@2.7.0'), {
      tag: '@bscotch/yy@2.7.0',
      name: '@bscotch/yy',
      version: '2.7.0',
    });
    assert.deepEqual(parseVersionTag('crashlands-editor@0.30.0'), {
      tag: 'crashlands-editor@0.30.0',
      name: 'crashlands-editor',
      version: '0.30.0',
    });
    assert.equal(parseVersionTag('v6.0.0'), undefined);
    assert.equal(parseVersionTag('@bscotch/yy'), undefined);
    assert.equal(parseVersionTag('foo@notaversion'), undefined);
  });

  it('parses git log output', () => {
    const R = '\x1e';
    const F = '\x1f';
    const raw = [
      `${R}aaa${F}2026-01-02T03:04:05-06:00${F}HEAD -> develop, tag: a@1.0.0, tag: @s/b@2.0.0, origin/develop${F}fix: Thing\n\nBody text\n${F}\n\npackages/a/x.ts\npackages\\b\\y.ts\n`,
      `${R}bbb${F}2026-01-01T00:00:00Z${F}${F}Merge branch 'x'\n${F}\n`,
    ].join('');
    const commits = parseGitLog(raw);
    assert.equal(commits.length, 2);
    assert.deepEqual(commits[0], {
      hash: 'aaa',
      date: new Date('2026-01-02T09:04:05Z'),
      tags: ['a@1.0.0', '@s/b@2.0.0'],
      body: 'fix: Thing\n\nBody text',
      files: ['packages/a/x.ts', 'packages/b/y.ts'],
    });
    assert.deepEqual(commits[1].files, []);
    assert.deepEqual(commits[1].tags, []);
  });
});

describe('workspace sorting', () => {
  it('sorts dependencies before dependents, then by name', () => {
    const sorted = sortTopologically([
      project('c', '1.0.0', { devDeps: ['b'] }),
      project('b', '1.0.0', { deps: ['a'] }),
      project('z', '1.0.0'),
      project('a', '1.0.0'),
    ]);
    assert.deepEqual(
      sorted.map((p) => p.name),
      ['a', 'z', 'b', 'c'],
    );
  });

  it('throws on cycles', () => {
    assert.throws(
      () =>
        sortTopologically([
          project('a', '1.0.0', { deps: ['b'] }),
          project('b', '1.0.0', { deps: ['a'] }),
        ]),
      /Dependency cycle among: a, b/,
    );
  });
});
