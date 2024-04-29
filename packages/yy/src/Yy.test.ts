import { undent } from '@bscotch/utility';
import { expect } from 'chai';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import fs from 'node:fs/promises';
import { z } from 'zod';
import { Yy } from './Yy.js';
import { yyResourceTypes } from './types/YyBase.js';
import { FixedNumber, fixedNumber, nameField } from './types/utility.js';

const sampleOutDir = './samples-out';
mkdirSync(sampleOutDir, { recursive: true });

async function expectToThrowAsync(f: () => Promise<any>): Promise<void> {
  try {
    await f();
  } catch {
    return;
  }
  throw new Error('Expected to throw');
}

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
    expect(Yy.areEqual(1, 2)).to.be.false;
    expect(Yy.areEqual({ a: 'hello' }, { a: 'world' })).to.be.false;

    const yy1 = { a: 1, b: 2, c: 3, d: [0, { na: { nb: { nc: ['deep!'] } } }] };
    expect(Yy.areEqual(yy1, yy1), 'An object should equal itself').to.be.true;
    expect(
      Yy.areEqual(yy1, {
        c: 3,
        b: 2,
        d: [0, { na: { nb: { nc: ['deep!'] } } }],
        a: 1,
      }),
      'An object should equal another object with the same keys in a different order',
    ).to.be.true;
    expect(
      Yy.areEqual(yy1, { a: 1, b: 2, c: 3 }),
      'An object should not equal another object with fewer keys',
    ).to.be.false;
    expect(
      Yy.areEqual(yy1, {
        a: 1,
        b: 2,
        c: 3,
        d: [0, { na: { nb: { nc: ['deep!'] } } }],
        e: 4,
      }),
      'An object should not equal another object with more keys',
    ).to.be.false;
    expect(
      Yy.areEqual(yy1, {
        a: 1,
        b: 2,
        c: 3,
        d: [0, { na: { nb: { nc: ['deep!', 'extra!'] } } }],
      }),
      'An object should not equal another object with a deep difference',
    ).to.be.false;
    expect(Yy.areEqual(1, 1), 'A number should equal itself').to.be.true;
    expect(
      Yy.areEqual({ a: '1' }, { a: 1 }),
      'A numeric string should still count as equal to the corresponding number',
    ).to.be.true;
    expect(
      Yy.areEqual({ a: 10.111 }, { a: new FixedNumber(10.111, 1) }),
      'A FixedNumber should equal a regular number',
    ).to.be.true;
    expect(
      Yy.areEqual(
        { a: new FixedNumber(10.111, 2) },
        { a: new FixedNumber(10.111, 3) },
      ),
      'A FixedNumber should equal another FixedNumber with a different precision',
    ).to.be.true;
  });

  it('can use FixedNumber instances in place of number primitives', function () {
    expect(new FixedNumber(1)).to.be.an.instanceof(FixedNumber);
    // @ts-expect-error
    expect(new FixedNumber(1) == 1).to.be.true;
    // @ts-expect-error
    expect(new FixedNumber(1) == 2).to.be.false;
    // @ts-expect-error
    expect(new FixedNumber(32) + 2 == 34).to.be.true;
    // @ts-expect-error
    expect(new FixedNumber(32) + 2 == 3).to.be.false;
    // @ts-expect-error
    expect(new FixedNumber(10.11) == 10.11).to.be.true;
    // @ts-expect-error
    expect(new FixedNumber(10.11) === 10.11).to.be.false;
    // @ts-expect-error
    expect(new FixedNumber(10.11) > 10).to.be.true;
    // @ts-expect-error
    expect(new FixedNumber(10.11) < 12).to.be.true;
    // @ts-expect-error
    expect(new FixedNumber(10.11) < 10).to.be.false;
    // @ts-expect-error
    expect(new FixedNumber(10.11) > 12).to.be.false;
    expect(`${new FixedNumber(10.123, 2)}`).to.equal('10.12');
    // @ts-expect-error
    expect(new FixedNumber(10.123, 2) == '10.12').to.be.false;
    // @ts-expect-error
    expect(new FixedNumber(10.123, 2) == '10.123').to.be.true;
  });

  it('can create GameMaker-style JSON', function () {
    expect(Yy.stringify(sampleData, sampleSchema)).to.equal(sampleDataAsString);
    expect(
      Yy.stringify(
        { num: 15.1234134 },
        z.object({ num: fixedNumber(undefined, 2) }),
      ),
    ).to.equal('{\r\n  "num": 15.12,\r\n}');
  });

  it('can parse Yy data', function () {
    expect(Yy.parse(sampleDataAsString, sampleSchema)).to.deep.equal(
      sampleData,
    );
  });

  it('can read GameMaker-style JSON', async function () {
    const data = await Yy.read('./samples/sample.yy');
    expect(data).to.deep.equal(sampleData);
  });

  it('can coerce yyFixed to enable writing fixed decimals', function () {
    const schema = z.object({
      one: fixedNumber(),
      two: fixedNumber(undefined, 2),
    });
    const toExpectedString = (n: number) => {
      return `{\r\n  "one": ${Number(n).toFixed(1)},\r\n  "two": ${Number(
        n,
      ).toFixed(2)},\r\n}`;
    };
    const cases = [0, 1, 1.2, 233.3333];
    for (const number of cases) {
      const data = { one: number, two: number };
      expect(Yy.stringify(data, schema)).to.equal(toExpectedString(number));
    }
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
      expect(sorted[i].id.path).to.equal(referenceOrder[i].id.path);
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
      expect(sorted[i].folderPath).to.equal(referenceOrder[i].folderPath);
    }
  });

  xit('can convert an old-format sprite yy file to the new format', async function () {
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
        // (Can't check if stringification is exactly correct, because samples may end up with different formatting than GameMaker applies)
        // Write to disk so we can eyeball it
        await Yy.write(`${outFolder}/${sampleFile}`, parsed, resourceType);
        if (parsed[nameField]) {
          // Make sure that we can stringify and get it back in the new format
          const stringified = Yy.stringify(parsed, resourceType);
          const reparsed = Yy.parse(stringified, resourceType);
          expect(reparsed[nameField]).to.equal(parsed[nameField]);
          expect(reparsed.resourceType).to.be.a('string');
          // @ts-expect-error
          expect(reparsed[`$${reparsed.resourceType}`]).to.be.a('string');
        }
      });
    }
  }
});
