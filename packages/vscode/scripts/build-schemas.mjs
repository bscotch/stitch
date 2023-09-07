import { pathy } from '@bscotch/pathy';
import {
  spriteDestConfigSchema,
  spriteSourceConfigSchema,
  spritesInfoSchema,
} from '@bscotch/sprite-source';
import { zodToJsonSchema } from 'zod-to-json-schema';

const schemas = [
  {
    schema: spriteDestConfigSchema,
    name: 'Sprite Import Configuration',
    filename: 'stitch.sprite-imports.schema.json',
  },
  {
    schema: spriteSourceConfigSchema,
    name: 'Sprite Source Configuration',
    filename: 'stitch.sprite-source.schema.json',
  },
  {
    schema: spritesInfoSchema,
    name: 'Sprite Cache',
    filename: 'stitch.sprite-cache.schema.json',
  },
];

const dir = pathy('schemas');
await dir.ensureDirectory();

for (const { schema, name, filename } of schemas) {
  const jsonSchema = zodToJsonSchema(schema);
  await pathy(filename, dir).write(jsonSchema);
}
