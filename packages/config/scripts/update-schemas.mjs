import { pathy } from '@bscotch/pathy';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { stitchConfigSchema } from '../dist/schema.js';

const schemasDir = pathy('./schemas');
await schemasDir.ensureDirectory();

const asSchema = zodToJsonSchema(stitchConfigSchema);

await pathy(schemasDir).join(`stitch.config.schema.json`).write(asSchema);
