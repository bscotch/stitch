import { pathy } from '@bscotch/pathy';
import { ok } from 'assert';
import { compile } from 'json-schema-to-typescript';
import { Packed } from '../dist/Packed.js';

const sampleYypPath = pathy(
  '../../../crashlands-2/Crashlands2/Crashlands2.yyp',
);

const packed = await Packed.from(sampleYypPath);
ok(packed);

/** @type {string} */
let dataString = await packed.packedPath.read({ parse: false });
// Replace all refs with proper JSON Pointers
dataString = dataString
  .replace(/"\$ref":\s*"([^"]+)"/g, '"$ref": "#/$defs/$1"')
  .replace(
    /"additionalProperties":\s*0(\.0)?/g,
    '"additionalProperties": false',
  )
  .replace(/"additionalProperties":\s*1(\.0)?/g, '"additionalProperties": true')
  .replace(/"bConst"/g, '"const"');

/** @type {Packed['schemas']} */
const schemas = JSON.parse(dataString).schemas;

// We use "required: true" to indicate that ALL properties are required,
// so we need to iterate through all schemas to set that to JSON Schema spec
for (const schema of Object.values(schemas)) {
  recursivelyPortBschemaToJsonSchema(schema);
}

// await pathy('tmp.json').write(schemas);
const schemaNames = Object.keys(schemas);
const rootSchema = {
  $defs: schemas,
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: schemaNames,
  properties: Object.fromEntries(
    schemaNames.map((name) => [name, { $ref: `#/$defs/${name}` }]),
  ),
};

// // We want types for Storylines and Quests
// const storylineSchema = packed.getSchema('cl2_storyline');
// ok(storylineSchema);
// const questSchema = packed.getSchema('cl2_quest');
// ok(questSchema);

const storylineTypes = await compile(rootSchema, 'Schemas', {
  additionalProperties: false,
});
await pathy('src/types.cl2.ts').write(
  `export namespace Crashlands2 {\n\t${storylineTypes.replace(
    /\n/g,
    '\n\t',
  )}\n}\n`,
);

/**
 * @param {import('../dist/types.js').Bschema} schema
 */
function recursivelyPortBschemaToJsonSchema(schema) {
  const isObject =
    schema &&
    (schema.type === 'object' ||
      'properties' in schema ||
      'additionalProperties' in schema);
  if (!isObject) return schema;

  const propNames = Object.keys(schema.properties || {});
  if (schema.required && !Array.isArray(schema.required)) {
    // Then ALL fields are required
    schema.required = propNames;
  }
  // Continue on the property fields
  for (const propName of propNames) {
    recursivelyPortBschemaToJsonSchema(schema.properties[propName]);
  }
  recursivelyPortBschemaToJsonSchema(schema.additionalProperties);
  return schema;
}
