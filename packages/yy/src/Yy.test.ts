import { undent } from '@bscotch/utility';
import { expect } from 'chai';
import { existsSync, mkdirSync, readdirSync } from 'fs';
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
