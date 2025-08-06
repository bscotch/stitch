import { pathy } from '@bscotch/pathy';
import { Yy } from '@bscotch/yy';
import { z } from 'zod';

// UPDATE THE JSON SCHEMAS

const schemasDir = pathy('./schemas');
await schemasDir.ensureDirectory();
for (const [name, schema] of Object.entries(Yy.schemas)) {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7' });
  const jsonSchemaString = JSON.stringify(
    jsonSchema,
    (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    },
    2,
  );
  await pathy(schemasDir).join(`${name}.json`).write(jsonSchemaString);
}
