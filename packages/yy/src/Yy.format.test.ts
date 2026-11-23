import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { Yy } from './Yy.ts';
import { compareYypPaths } from './Yy.stringify.ts';
import type { Yyp } from './types/Yyp.ts';
import { formatGameMakerFloat } from './types/utility.ts';

/** Minimal yyp-like object, used to tell the stringifier the IDE version */
function yypForVersion(IDEVersion: string): Yyp {
  return { '%Name': 'Sample', MetaData: { IDEVersion } } as unknown as Yyp;
}

describe('GameMaker formatting', function () {
  it('formats floats the way GameMaker does', function () {
    const cases: [number, string][] = [
      [0, '0.0'],
      [1, '1.0'],
      [-10, '-10.0'],
      [0.035, '0.035'],
      [88.888885, '88.888885'],
      [2.525, '2.525'],
      [0.0001, '0.0001'],
      [1.53235e-5, '1.53235E-05'],
      [1e-10, '1E-10'],
      [123456789012345, '123456789012345.0'],
      [1e15, '1E+15'],
    ];
    for (const [value, expected] of cases) {
      assert.equal(formatGameMakerFloat(value), expected);
    }
  });

  it('writes GameMaker float fields as floats, without losing precision', function () {
    for (const value of [0.035, 88.888885, 81.6, 0, 1]) {
      const float = formatGameMakerFloat(value);
      const data = {
        $GMRoom: 'v1',
        '%Name': 'rm',
        instances: [
          // Identified by resourceType
          { resourceType: 'GMRInstance', x: value, colour: 1 },
        ],
        name: 'rm',
        // Identified by parent key (no resourceType)
        physicsSettings: { PhysicsWorldPixToMetres: value },
        resourceType: 'GMRoom',
        resourceVersion: '2.0',
        // Also an int, since it's not a float on the room
        x: 1,
      };
      const stringified = Yy.stringify(data);
      assert.match(stringified, new RegExp(`"colour":1,`));
      assert.match(stringified, new RegExp(`"x":${float.replace('.', '\\.')},`));
      assert.match(
        stringified,
        new RegExp(`"PhysicsWorldPixToMetres":${float.replace('.', '\\.')},`),
      );
      assert.match(stringified, /\n {2}"x":1,/);
    }
  });

  it('parses all numbers as plain numbers', function () {
    const parsed = Yy.parse(
      '{"$GMObject":"","%Name":"o","name":"o","physicsDensity":0.5,"physicsFriction":0.0,"physicsGroup":1,"resourceType":"GMObject","resourceVersion":"2.0",}',
      'objects',
    );
    assert.equal(parsed.physicsDensity, 0.5);
    assert.equal(parsed.physicsFriction, 0);
    assert.equal(typeof parsed.physicsFriction, 'number');
    assert.equal(parsed.physicsGroup, 1);
  });

  it('writes floats in parsed data', function () {
    const sound = Yy.parse(
      '{"$GMSound":"v2","%Name":"s","duration":2.0,"name":"s","resourceType":"GMSound","resourceVersion":"2.0","soundFile":"s.wav","volume":1.0,}',
      'sounds',
    );
    const stringified = Yy.stringify(sound, 'sounds');
    assert.match(stringified, /"duration":2\.0,/);
    assert.match(stringified, /"volume":1\.0,/);
    assert.match(stringified, /"bitDepth":1,/);
  });

  it('writes integers as integers even if BigInt.prototype.toJSON is patched', function () {
    // Some libraries patch this to allow JSON.stringify on bigints,
    // and VSCode extensions share a process. See bscotch/stitch#295 and #297.
    const proto = BigInt.prototype as unknown as { toJSON?: () => string };
    const original = proto.toJSON;
    proto.toJSON = function (this: bigint) {
      return this.toString();
    };
    try {
      const yyp = Yy.parse(
        '{"%Name":"p","AudioGroups":[{"%Name":"audiogroup_default","name":"audiogroup_default","resourceType":"GMAudioGroup","resourceVersion":"2.0","targets":-1,},],"IncludedFiles":[{"%Name":"a.txt","CopyToMask":-1,"filePath":"datafiles","name":"a.txt","resourceType":"GMIncludedFile","resourceVersion":"2.0",},],"configs":{"children":[],"name":"Default",},"MetaData":{"IDEVersion":"2026.100.0.1199",},"name":"p","resourceType":"GMProject","resourceVersion":"2.0",}',
        'project',
      );
      const stringified = Yy.stringify(yyp, 'project');
      assert.match(stringified, /"targets":-1,/);
      assert.match(stringified, /"CopyToMask":-1,/);
      assert.doesNotMatch(stringified, /"-1"/);
    } finally {
      if (original) proto.toJSON = original;
      else delete proto.toJSON;
    }
  });

  it('sorts yyp paths independently of the system locale', function () {
    // GameMaker's order (from bscotch/stitch#298). A Chinese system
    // locale would sort the CJK paths before the latin ones.
    const gameMakerOrder = [
      'folders/Objects.yy',
      'folders/Particle Systems.yy',
      'folders/Rooms.yy',
      'folders/Scripts.yy',
      'folders/便签.yy',
      'folders/图块集.yy',
      'folders/声音.yy',
      'folders/声音/Battle BGM.yy',
      'folders/字体.yy',
      'folders/物体.yy',
      'folders/物体/Bullet.yy',
      'folders/物体/Bullet/bullet effect.yy',
      'folders/脚本.yy',
    ];
    const sorted = [...gameMakerOrder].reverse().sort(compareYypPaths);
    assert.deepEqual(sorted, gameMakerOrder);
  });

  it('inlines number arrays within inlined objects (2024.1400+)', function () {
    const data = {
      $GMExtension: 'v1',
      '%Name': 'ext',
      files: [{ args: [1, 2], names: ['a'] }],
      name: 'ext',
      resourceType: 'GMExtension',
      resourceVersion: '2.0',
      root: [1, 2],
    };
    const modern = Yy.stringify(data, undefined, yypForVersion('2026.100.0.1199'));
    assert.match(modern, /"args":\[1,2,\],/);
    // String arrays are still multi-line
    assert.match(modern, /"names":\[\n {8}"a",\n {6}\],/);
    // Root-level number arrays are still multi-line
    assert.match(modern, /"root":\[\n {4}1,\n {4}2,\n {2}\],/);

    const older = Yy.stringify(data, undefined, yypForVersion('2024.200.0.516'));
    assert.match(older, /"args":\[\n/);
  });

  it('applies GameMaker 2024.1400+ upgrades to audio groups, sounds, and sprites', function () {
    const yyp = yypForVersion('2026.100.0.1199');
    const audioGroup = Yy.stringify(
      {
        $GMAudioGroup: '',
        '%Name': 'ag',
        name: 'ag',
        resourceType: 'GMAudioGroup',
        resourceVersion: '2.0',
        targets: -1n,
      },
      undefined,
      yyp,
    );
    assert.match(audioGroup, /"\$GMAudioGroup":"v1"/);
    assert.match(audioGroup, /"exportDir":""/);

    // A "0" channelFormat (mono) must not be replaced by the default
    const sound = Yy.parse(
      Yy.stringify(
        {
          $GMSound: 'v2',
          '%Name': 's',
          channelFormat: 0,
          compressionQuality: 0,
          name: 's',
          resourceType: 'GMSound',
          resourceVersion: '2.0',
          soundFile: 's.wav',
        },
        'sounds',
        yyp,
      ),
    ) as Record<string, unknown>;
    assert.equal(sound.channelFormat, 0);
    assert.equal(sound.compressionQuality, 0);

    const sprite = Yy.parse(
      Yy.stringify(
        {
          $GMSprite: '',
          '%Name': 'sp',
          frames: [
            {
              $GMSpriteFrame: '',
              '%Name': 'f',
              name: 'f',
              resourceType: 'GMSpriteFrame',
              resourceVersion: '2.0',
            },
          ],
          name: 'sp',
          resourceType: 'GMSprite',
          resourceVersion: '2.0',
          sequence: {
            $GMSequence: '',
            '%Name': 'sp',
            name: 'sp',
            resourceType: 'GMSequence',
            resourceVersion: '2.0',
          },
        },
        undefined,
        yyp,
      ),
    ) as any;
    assert.equal(sprite.$GMSprite, 'v2');
    assert.equal(sprite.frames[0].$GMSpriteFrame, 'v1');
    assert.equal(sprite.sequence.$GMSequence, 'v1');
  });
});
