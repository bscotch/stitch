import { pathy } from '@bscotch/pathy';
import { z } from 'zod';
import { spritesInfoInfo } from '../dist/SpriteCache.schemas.js';
import { spriteDestConfigInfo } from '../dist/SpriteDest.schemas.js';
import { spriteSourceConfigInfo } from '../dist/SpriteSource.schemas.js';
import { jsonSchemaRemoteDir } from '../dist/constants.js';

const schemas = [spriteDestConfigInfo, spriteSourceConfigInfo, spritesInfoInfo];

const dir = pathy('schemas');
await dir.ensureDirectory();

for (const { schema, name, filename } of schemas) {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7' });
  // Remove the '$schema' property, since it's only needed for the literals,
  // and add the $id property
  // @ts-expect-error
  delete jsonSchema.properties.$schema;
  jsonSchema.$id = `${jsonSchemaRemoteDir}/${filename}`;
  await pathy(filename, dir).write(jsonSchema);
}
