import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameMakerVersionString } from './GameMakerVersionString.ts';
import { joinPaths, parsePath, toPosixPath } from './utility.ts';

describe('Utilities', function () {
  it('can join path parts', function () {
    assert.equal(joinPaths('/hello/', '/world/'), '/hello/world/');
    assert.equal(
      joinPaths('hello', 'world', '/and', '/another/', '/thing'),
      'hello/world/and/another/thing',
    );
  });

  it('can ensure posix path separators', function () {
    assert.equal(
      toPosixPath('hello\\world\\and\\another\\thing'),
      'hello/world/and/another/thing',
    );
    assert.equal(
      toPosixPath('C:\\Okay\\Now/We Have\\/Got_IT\\'),
      'C:/Okay/Now/We Have//Got_IT/',
    );
  });

  it('can parse path parts', function () {
    assert.deepEqual(parsePath('hello\\world/file.png'), {
      filename: 'file.png',
      fullpath: 'hello/world/file.png',
      parent: 'hello/world/',
      ext: '.png',
    });
  });

  it('can parse and compare GameMaker version strings', function () {
    const versions = GameMakerVersionString.from([
      '2023.3.1.401',
      '2023.4.1.401',
      '2022.3.1.401',
      '2023.3.1.402',
    ]);
    GameMakerVersionString.sort(versions);
    assert.deepEqual(
      versions.map((v) => v.version),
      ['2022.3.1.401', '2023.3.1.401', '2023.3.1.402', '2023.4.1.401'],
    );
    assert.deepEqual(versions[0].parsed, [2022, 3, 1, 401]);

    assert.equal(
      GameMakerVersionString.gt('2023.3.1.401', '2023.3.1.400'),
      true,
    );
    assert.equal(
      GameMakerVersionString.gt('2023.3.1.401', '2023.3.1.401'),
      false,
    );
    assert.equal(
      GameMakerVersionString.gte('2023.3.1.401', '2023.3.1.401'),
      true,
    );
    assert.equal(
      GameMakerVersionString.gte('2023.3.1.401', '2023.3.1.400'),
      true,
    );
    assert.equal(
      GameMakerVersionString.eq('2023.3.1.401', '2023.3.1.401'),
      true,
    );
    assert.equal(
      GameMakerVersionString.eq('2023.3.1.401', '2023.3.1.400'),
      false,
    );
  });

  it('can normalize and group GameMaker version strings', function () {
    assert.equal(GameMakerVersionString.normalize('2024.06.2.162'), '2024.6.2.162');
    assert.equal(GameMakerVersionString.family('2026.100.0.1199'), '2026.100.0');
    assert.equal(GameMakerVersionString.family('2024.06.2.162'), '2024.6.2');
    assert.equal(GameMakerVersionString.isBetaNumbering('2026.100.0.1199'), true);
    assert.equal(GameMakerVersionString.isBetaNumbering('2026.1.0.27'), false);
    assert.equal(GameMakerVersionString.isBetaNumbering('2.3.7.606'), false);
    assert.throws(() => GameMakerVersionString.parse('2024.1.0'));
  });

  it('can compare GameMaker version strings without normalization', function () {
    // Default comparison treats Beta minors (x100) as their stable equivalents
    assert.equal(GameMakerVersionString.compare('2024.1400.0.900', '2024.14.0.907'), -1);
    // Raw comparison does not
    assert.equal(GameMakerVersionString.compareRaw('2024.1400.0.900', '2024.14.0.907'), 1);
    assert.equal(GameMakerVersionString.compareRaw('2026.100.0.1199', '2026.100.0.1199'), 0);
    assert.equal(GameMakerVersionString.compareRaw('2026.100.0.99', '2026.100.0.1199'), -1);
  });
});
