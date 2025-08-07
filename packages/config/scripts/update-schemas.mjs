import { pathy } from '@bscotch/pathy';
// import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import { jsonSchemaUrl, stitchConfigSchema } from '../dist/schema.js';

const schemasDir = pathy('./schemas');
await schemasDir.ensureDirectory();

const asSchema = z.toJSONSchema(stitchConfigSchema, {
  target: 'draft-7',
  unrepresentable: 'any',
}); //zodToJsonSchema(stitchConfigSchema);
// Remove the '$schema' property, since it's only needed for the literals,
// and add the $id property
// @ts-expect-error
delete asSchema.properties.$schema;

asSchema.$id = jsonSchemaUrl;

await pathy(schemasDir).join(`stitch.config.schema.json`).write(asSchema);
