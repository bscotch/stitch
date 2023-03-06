import { pathy } from '@bscotch/pathy';
import { Yy } from '@bscotch/yy';
import { zodToJsonSchema } from 'zod-to-json-schema';

// UPDATE THE JSON SCHEMAS

const schemasDir = pathy('./schemas');
await schemasDir.ensureDirectory();
for (const [name, schema] of Object.entries(Yy.schemas)) {
  const jsonSchema = zodToJsonSchema(schema);
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
