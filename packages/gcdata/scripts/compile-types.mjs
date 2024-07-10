import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();
//
import { pathy } from '@bscotch/pathy';
import { ok } from 'assert';
import { compile } from 'json-schema-to-typescript';
import { GameChanger, Gcdata } from '../dist/GameChanger.js';
import { computeMotePointersFromSchema } from '../dist/util.js';

const packed = await GameChanger.from('Crashlands2');
ok(packed);

/** @type {string} */
let dataString = JSON.stringify(packed.base.data);
// Replace all refs with proper JSON Pointers
dataString = dataString
  .replace(/"\$ref":\s*"([^"]+)"/g, '"$ref": "#/$defs/$1"')
  .replace(
    /"additionalProperties":\s*0(\.0)?/g,
    '"additionalProperties": false',
  )
  .replace(/"additionalProperties":\s*1(\.0)?/g, '"additionalProperties": true')
  .replace(/"bConst"/g, '"const"');

/** @type {Gcdata['schemas']} */
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

const schemaTypes = await compile(rootSchema, 'Schemas', {
  additionalProperties: false,
});
await pathy('src/cl2.types.auto.ts').write(
  `export namespace Crashlands2 {\n\t${schemaTypes.replace(
    /\n/g,
    '\n\t',
  )}\n}\n`,
);

await createPointerTypesFromSchema(
  'cl2_quest',
  'QuestMote',
  'quest',
  (pointer) => !pointer.startsWith('objectives'),
);
await createPointerTypesFromSchema(
  'cl2_storyline',
  'StorylineMote',
  'storyline',
);
await createPointerTypesFromSchema(
  'cl2_artisan_glads',
  'ComfortMote',
  'comfort',
  (pointer) => !pointer.startsWith('glads'),
);
await createPointerTypesFromSchema(
  'cl2_chat',
  'ChatMote',
  'chat',
  (pointer) => !pointer.startsWith('requirements'),
);
// Artisans & NPCs have similar schemas, but for our
// current case we only care about Idle Text, which both have,
// so we can just use one schema for types/pointers.
await createPointerTypesFromSchema(
  'cl2_npc',
  'CharacterMote',
  'character',
  (pointer) => !pointer.startsWith('spine'),
);

/**
 * @param {string} schemaId
 * @param {string} typeRootName
 * @param {string} outfileInfix
 * @param {(pointer:string)=>boolean} [pointerFilter]
 */
async function createPointerTypesFromSchema(
  schemaId,
  typeRootName,
  outfileInfix,
  pointerFilter,
) {
  // Create types for Quest Mote paths
  const schema = exists(packed).base.getSchema(schemaId);
  ok(schema, 'Could not find schema for ' + schemaId);
  const pointers = [
    ...computeMotePointersFromSchema(exists(packed).base, schema),
  ]
    .filter((p) => !pointerFilter || pointerFilter(p))
    .map((p) => `\`${p.replace(/\*/g, '${string}')}\``)
    .sort();
  await pathy(`src/cl2.${outfileInfix}.pointers.ts`).write(
    `export type ${typeRootName}DataPointer = \`data/\${${typeRootName}Pointer}\`;\nexport type ${typeRootName}Pointer = ${pointers.join(
      '\n  | ',
    )};\n`,
  );
}

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

/**
 * @template T
 * @param {T} thing
 * @returns {Exclude<T, undefined | null>}
 */
function exists(thing) {
  if ([undefined, null].includes(thing))
    throw new Error(`Expected ${thing} to exist`);
  return thing;
}
