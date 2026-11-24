import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { classifyYypPaths } from './discovery.ts';

describe('classifyYypPaths', function () {
  const p = (...parts: string[]) => path.resolve('/work', ...parts);

  it('keeps projects in subfolders, and flags prefabs and nested copies', function () {
    const result = classifyYypPaths([
      p('repo', 'Game', 'Game.yyp'),
      p('repo', 'Game', 'prefabs', 'io.vendor.thing', 'io.vendor.thing.yyp'),
      p('repo', 'Game', 'tests', 'Fixture', 'Fixture.yyp'),
      p('repo', 'Server', 'Server.yyp'),
    ]);
    assert.deepEqual(
      result.map((r) => r.kind),
      ['project', 'prefab', 'nested', 'project'],
    );
  });

  it('recognizes prefabs even without their project, but not other "prefabs" folders', function () {
    const result = classifyYypPaths([
      p('prefabs', 'io.vendor.thing', 'io.vendor.thing.yyp'),
      p('Prefabs', 'MyGame', 'Game', 'Game.yyp'),
    ]);
    assert.deepEqual(
      result.map((r) => r.kind),
      ['prefab', 'project'],
    );
  });

  it('treats sibling folders with a shared prefix as separate', function () {
    const result = classifyYypPaths([
      p('Game', 'Game.yyp'),
      p('Game2', 'Game2.yyp'),
    ]);
    assert.deepEqual(
      result.map((r) => r.kind),
      ['project', 'project'],
    );
  });
});
