import { pathy } from '@bscotch/pathy';
import { z } from 'zod';
import { jsonSchemaUrl, stitchConfigSchema } from '../dist/schema.js';

const schemasDir = pathy('./schemas');
await schemasDir.ensureDirectory();

const asSchema = z.toJSONSchema(stitchConfigSchema, {
  target: 'draft-7',
  unrepresentable: 'any',
});
// Remove the '$schema' property, since it's only needed for the literals,
// and add the $id property
// @ts-expect-error -- `properties` isn't typed on the generated schema
delete asSchema.properties.$schema;
// It has a default, so Zod lists it as required, but configs don't need it.
asSchema.required = asSchema.required?.filter((key) => key !== '$schema');
if (!asSchema.required?.length) delete asSchema.required;

asSchema.$id = jsonSchemaUrl;

await pathy(schemasDir).join(`stitch.config.schema.json`).write(asSchema);
