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
const dataString = await packed.packedPath.read({ parse: false });

// Replace all refs with proper JSON Pointers
/** @type {Packed['schemas']} */
const schemas = JSON.parse(
  dataString
    .replace(/"\$ref":\s*"([^"]+)"/g, '"$ref": "#/$defs/$1"')
    .replace(/"additionalProperties": 0\.0/g, '"additionalProperties": false')
    .replace(/"bConst"/g, '"const"'),
).schemas;

// await pathy('tmp.json').write(schemas);

// Construct a proper root schema with defs
const rootSchema = {
  $defs: schemas,
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['storyline', 'quest'],
  properties: {
    // We want types for Storylines and Quests
    storyline: { $ref: '#/$defs/cl2_storyline' },
    quest: { $ref: '#/$defs/cl2_quest' },
  },
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
