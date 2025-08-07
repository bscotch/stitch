import { pathy } from '@bscotch/pathy';
import assert from 'node:assert';
import test from 'node:test';
import z from 'zod';
import { permissiveStringRecord, stitchConfigSchema } from './schema.ts';

void test('can parse an empty config', async () => {
  await pathy('samples/empty.stitch.config.json')
    .withValidator(stitchConfigSchema)
    .read();
});

void test('can parse an partial config', async () => {
  await pathy('samples/partial.stitch.config.json')
    .withValidator(stitchConfigSchema)
    .read();
});

void test("can parse 'records' with fields like 'constructor'", () => {
  z.record(z.string(), z.string()).parse({ totallyFine: 'true' });
  assert.throws(() =>
    z
      .record(z.string(), z.string())
      .parse({ totallyFine: 'false', constructor: 'some string' }),
  );
  permissiveStringRecord.parse({ totallyFine: 'true' });
  assert.throws(() => permissiveStringRecord.parse({ totallyFine: false }));
  permissiveStringRecord.parse({
    totallyFine: 'TRUE',
    constructor: 'some string',
  });
});

void test('can parse a full config', async () => {
  const config = await pathy('samples/stitch.config.json').read();
  stitchConfigSchema.parse(config);
});
