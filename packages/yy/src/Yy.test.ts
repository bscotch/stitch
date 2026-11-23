import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { undent } from '@bscotch/utility';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import fs from 'node:fs/promises';
import { z } from 'zod';
import { Yy } from './Yy.ts';
import { GameMakerVersionString } from './types/GameMakerVersionString.ts';
import { yyResourceTypes } from './types/YyBase.ts';
import type { Yyp } from './types/Yyp.ts';
import { nameField } from './types/utility.ts';
import { setProjectVersion } from './versioning.ts';

/**
 * Samples from this IDE version onward must round-trip
 * byte-for-byte. (Older samples may not have been saved by
 * the GameMaker IDE, or use formats Stitch no longer writes exactly.)
 */
const exactRoundTripMinVersion = '2024.1400.0.904';

const sampleOutDir = './samples-out';
mkdirSync(sampleOutDir, { recursive: true });

const sampleData = {
  hello: 'world',
  parent: { child: ['10', '20'] },
  number: 15.1234134,
  array: [{ name: 'child1', field: true }, { name: 'child2' }],
};

const sampleSchema = z.object({
  hello: z.string(),
  parent: z.object({
    child: z.array(z.string()),
  }),
  number: z.number(),
  array: z.array(
    z.object({
      name: z.string(),
      field: z.boolean().optional(),
    }),
  ),
});

const sampleDataAsString = undent`
{
  "array": [
    {"field":true,"name":"child1",},
    {"name":"child2",},
  ],
  "hello": "world",
  "number": 15.1234134,
  "parent": {
    "child": [
      "10",
      "20",
    ],
  },
}
`.replace(/\r?\n/gm, '\r\n');

describe('Yy Files', function () {
  it('can test for functional equivalence between two Yy objects', function () {
    assert.equal(Yy.areEqual(1, 2), false);
    assert.equal(Yy.areEqual({ a: 'hello' }, { a: 'world' }), false);

    const yy1 = { a: 1, b: 2, c: 3, d: [0, { na: { nb: { nc: ['deep!'] } } }] };
    assert.equal(Yy.areEqual(yy1, yy1), true, 'An object should equal itself');
    assert.equal(
      Yy.areEqual(yy1, {
        c: 3,
        b: 2,
        d: [0, { na: { nb: { nc: ['deep!'] } } }],
        a: 1,
      }),
      true,
      'An object should equal another object with the same keys in a different order',
    );
    assert.equal(
      Yy.areEqual(yy1, { a: 1, b: 2, c: 3 }),
      false,
      'An object should not equal another object with fewer keys',
    );
    assert.equal(
      Yy.areEqual(yy1, {
        a: 1,
        b: 2,
        c: 3,
        d: [0, { na: { nb: { nc: ['deep!'] } } }],
        e: 4,
      }),
      false,
      'An object should not equal another object with more keys',
    );
    assert.equal(
      Yy.areEqual(yy1, {
        a: 1,
        b: 2,
        c: 3,
        d: [0, { na: { nb: { nc: ['deep!', 'extra!'] } } }],
      }),
      false,
      'An object should not equal another object with a deep difference',
    );
    assert.equal(Yy.areEqual(1, 1), true, 'A number should equal itself');
    assert.equal(
      Yy.areEqual({ a: '1' }, { a: 1 }),
      true,
      'A numeric string should still count as equal to the corresponding number',
    );
  });

  it('can create GameMaker-style JSON', function () {
    assert.equal(Yy.stringify(sampleData, sampleSchema), sampleDataAsString);
  });

  it('can parse Yy data', function () {
    assert.deepEqual(Yy.parse(sampleDataAsString, sampleSchema), sampleData);
  });

  it('can read GameMaker-style JSON', async function () {
    const data = await Yy.read('./samples/sample.yy');
    assert.deepEqual(data, sampleData);
  });

  it('yyp resource files sort as expected', function () {
    const referenceOrder = [
      {
        id: { name: 'Extension1', path: 'extensions/Extension1/Extension1.yy' },
      },
      {
        id: {
          name: 'o_child1_child',
          path: 'objects/o_child1_child/o_child1_child.yy',
        },
      },
      { id: { name: 'o_child1', path: 'objects/o_child1/o_child1.yy' } },
      { id: { name: 'o_child2', path: 'objects/o_child2/o_child2.yy' } },
      { id: { name: 'o_object', path: 'objects/o_object/o_object.yy' } },
      { id: { name: 'o_parent', path: 'objects/o_parent/o_parent.yy' } },
      {
        id: {
          name: 'o_world_element',
          path: 'objects/o_world_element/o_world_element.yy',
        },
      },
      { id: { name: 'Room1', path: 'rooms/Room1/Room1.yy' } },
      { id: { name: 'bump', path: 'scripts/bump/bump.yy' } },
      {
        id: { name: 'Complicated', path: 'scripts/Complicated/Complicated.yy' },
      },
      {
        id: {
          name: 'FunctionSelf',
          path: 'scripts/FunctionSelf/FunctionSelf.yy',
        },
      },
      { id: { name: 'Futures', path: 'scripts/Futures/Futures.yy' } },
      { id: { name: 'Generics', path: 'scripts/Generics/Generics.yy' } },
      { id: { name: 'Jsdocs', path: 'scripts/Jsdocs/Jsdocs.yy' } },
      { id: { name: 'Reactions', path: 'scripts/Reactions/Reactions.yy' } },
      { id: { name: 'Recovery', path: 'scripts/Recovery/Recovery.yy' } },
      { id: { name: 's__a', path: 'scripts/s__a/s__a.yy' } },
      { id: { name: 's_a', path: 'scripts/s_a/s_a.yy' } },
      { id: { name: 's_B', path: 'scripts/s_B/s_B.yy' } },
      { id: { name: 'sa___a', path: 'scripts/sa___a/sa___a.yy' } },
      { id: { name: 'sa__a', path: 'scripts/sa__a/sa__a.yy' } },
      { id: { name: 'sa_a', path: 'scripts/sa_a/sa_a.yy' } },
      { id: { name: 'Script1', path: 'scripts/Script1/Script1.yy' } },
      { id: { name: 'Withing', path: 'scripts/Withing/Withing.yy' } },
    ];

    const sorted = [...referenceOrder].sort((a, b) =>
      a.id.path.toLowerCase().localeCompare(b.id.path.toLowerCase()),
    );

    for (let i = 0; i < referenceOrder.length; i++) {
      assert.equal(sorted[i].id.path, referenceOrder[i].id.path);
    }
  });

  it('yyp folders sort as expected', function () {
    const referenceOrder = [
      {
        $GMFolder: '',
        '%Name': 'Extensions',
        folderPath: 'folders/Extensions.yy',
        name: 'Extensions',
        resourceType: 'GMFolder',
        resourceVersion: '2.0',
      },
      {
        $GMFolder: '',
        '%Name': 'Objects',
        folderPath: 'folders/Objects.yy',
        name: 'Objects',
        resourceType: 'GMFolder',
        resourceVersion: '2.0',
      },
      {
        $GMFolder: '',
        '%Name': 'Rooms',
        folderPath: 'folders/Rooms.yy',
        name: 'Rooms',
        resourceType: 'GMFolder',
        resourceVersion: '2.0',
      },
      {
        $GMFolder: '',
        '%Name': 'Scripts',
        folderPath: 'folders/Scripts.yy',
        name: 'Scripts',
        resourceType: 'GMFolder',
        resourceVersion: '2.0',
      },
      {
        $GMFolder: '',
        '%Name': 'Subfolder',
        folderPath: 'folders/Scripts/Subfolder.yy',
        name: 'Subfolder',
        resourceType: 'GMFolder',
        resourceVersion: '2.0',
      },
      {
        $GMFolder: '',
        '%Name': 'Subsubfolder',
        folderPath: 'folders/Scripts/Subfolder/Subsubfolder.yy',
        name: 'Subsubfolder',
        resourceType: 'GMFolder',
        resourceVersion: '2.0',
      },
      {
        $GMFolder: '',
        '%Name': 'Sorting',
        folderPath: 'folders/Sorting.yy',
        name: 'Sorting',
        resourceType: 'GMFolder',
        resourceVersion: '2.0',
      },
      {
        $GMFolder: '',
        '%Name': 'group__a',
        folderPath: 'folders/Sorting/group__a.yy',
        name: 'group__a',
        resourceType: 'GMFolder',
        resourceVersion: '2.0',
      },
      {
        $GMFolder: '',
        '%Name': 'group_a',
        folderPath: 'folders/Sorting/group_a.yy',
        name: 'group_a',
        resourceType: 'GMFolder',
        resourceVersion: '2.0',
      },
    ];
    const sorted = [...referenceOrder].sort((a, b) =>
      a.folderPath.toLowerCase().localeCompare(b.folderPath.toLowerCase()),
    );
    for (let i = 0; i < referenceOrder.length; i++) {
      assert.equal(sorted[i].folderPath, referenceOrder[i].folderPath);
    }
  });

  it.skip('can convert an old-format sprite yy file to the new format', async function () {
    const project = await Yy.read(
      './samples/project/Crashlands2.yyp',
      'project',
    );
    const rawSprite = JSON.parse(
      await fs.readFile('./samples/to-convert.yy', 'utf8'),
    );
    const stringified = Yy.stringify(rawSprite, 'sprites', project);
    console.log(stringified);
  });

  for (const resourceType of ['project', ...yyResourceTypes] as const) {
    const samplesFolder = `./samples/${resourceType}`;
    const outFolder = `${sampleOutDir}/${resourceType}`;
    if (!existsSync(samplesFolder)) {
      it.skip(`can validate a ${resourceType} file (no samples)`);
      continue;
    }
    mkdirSync(outFolder, { recursive: true });
    // NOTE: Must be sync for tests to run!
    const sampleFiles = readdirSync(samplesFolder);

    for (const sampleFile of sampleFiles) {
      it(`can validate a ${resourceType} file (${sampleFile.replace(
        /\.yyp?$/,
        '',
      )})`, async function () {
        const yyFilePath = `${samplesFolder}/${sampleFile}`;
        // Will throw if invalid
        const parsed = await Yy.read(yyFilePath, resourceType);

        // Samples named after recent GameMaker IDE versions (e.g.
        // `2026.100.0.1199-frames.yy`) were saved by that IDE version,
        // and so must be reproduced exactly when stringified.
        const ideVersion = sampleFile.match(/^\d+\.\d+\.\d+\.\d+/)?.[0];
        if (
          ideVersion &&
          new GameMakerVersionString(ideVersion).gte(exactRoundTripMinVersion)
        ) {
          const original = await fs.readFile(yyFilePath, 'utf8');
          const yyp = {
            '%Name': 'SampleProject',
            MetaData: { IDEVersion: ideVersion },
          } as unknown as Yyp;
          assert.equal(Yy.stringify(parsed, resourceType, yyp), original);
        }
        // (Can't check if stringification is exactly correct, because samples may end up with different formatting than GameMaker applies)
        // Write to disk so we can eyeball it
        await Yy.write(`${outFolder}/${sampleFile}`, parsed, resourceType);
        if (parsed[nameField]) {
          // Make sure that we can stringify and get it back in the new format
          const stringified = Yy.stringify(parsed, resourceType);
          const reparsed = Yy.parse(stringified, resourceType);
          assert.equal(reparsed[nameField], parsed[nameField]);
          assert.equal(typeof reparsed.resourceType, 'string');
          assert.equal(
            typeof (reparsed as Record<string, unknown>)[
              `$${reparsed.resourceType}`
            ],
            'string',
          );
        }
      });
    }
  }

  it('can set the version in project options files', async function () {
    const yypPath = 'samples-out/project.yyp';
    await fs.copyFile('samples-out/project/Crashlands2.yyp', yypPath);
    mkdirSync('samples-out/options', { recursive: true });
    await fs.cp('samples/options/', 'samples-out/options', { recursive: true });

    await setProjectVersion(yypPath, '10.9.8.7');
  });
});
