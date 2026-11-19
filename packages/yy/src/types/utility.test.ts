import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameMakerVersionString } from './GameMakerVersionString.ts';
import { FixedNumber, joinPaths, parsePath, toPosixPath } from './utility.ts';

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

  it('can use FixedNumber instances in place of number primitives', function () {
    assert.ok(new FixedNumber(1) instanceof FixedNumber);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(1) == 1, true);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(1) == 2, false);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(32) + 2 == 34, true);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(32) + 2 == 3, false);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(10.11) == 10.11, true);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(10.11) === 10.11, false);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(10.11) > 10, true);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(10.11) < 12, true);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(10.11) < 10, false);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(10.11) > 12, false);
    assert.equal(`${new FixedNumber(10.123, 2)}`, '10.12');
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(10.123, 2) == '10.12', false);
    // @ts-expect-error Types are compatible despite not looking like it
    assert.equal(new FixedNumber(10.123, 2) == '10.123', true);
  });
});
