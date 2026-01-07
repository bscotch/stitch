import { pathy } from '@bscotch/pathy';
import test from 'node:test';
import { stitchConfigSchema } from './schema.ts';

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

void test('can parse a full config', async () => {
  const config = await pathy('samples/stitch.config.json').read();
  stitchConfigSchema.parse(config);
});
