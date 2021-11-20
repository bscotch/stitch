/**
 * @file Create Typescript types for GML, based on types from GMEdit
 *
 * Based on the work done by Yellow Afterlife for the Haskell-based
 * ["GMEdit" editor project](https://github.com/YellowAfterlife/GMEdit).
 *
 */

import { assert } from '../lib/errors.js';
import {
  existsSync,
  readFileSync,
  readJSONSync,
  writeFileSync,
  writeJSONSync,
} from 'fs-extra';
import path from 'path';

/**
 * The local path to an installation of GMEdit
 */
const gmeditDir = process.argv[2];
const gmeditResourceDir = path.join(gmeditDir, 'resources', 'app', 'api');
const gmeditConfigDir = path.join(gmeditResourceDir, 'v23');
const gmeditConfigFile = path.join(gmeditConfigDir, 'config.json');
const exportRawDir = 'gml-types';
// const exportTypesDir = 'src/build';

assert(existsSync(gmeditDir), `GMEdit directory ${gmeditDir} does not exist`);

assert(
  existsSync(gmeditConfigFile),
  `GMEdit config file ${gmeditConfigFile} does not exist`,
);

const config = readJSONSync(gmeditConfigFile) as {
  patchFiles: string[];
  additionalKeywords: string[];
};
// Reverse so we load the latest patches first and skip
// the earlier ones
config.patchFiles.reverse();

interface Gms2Function {
  name: string;
  generics?: { name: string; type?: string }[];
  params?: {
    name: string;
    type?: string;
    default?: string;
    optional?: boolean;
  }[];
  returnType?: string;
}

const globals = {
  types: {} as { [name: string]: string[] },
  variables: [] as {
    name: string;
    type?: string;
    isReadOnly?: boolean;
    isInstance?: boolean;
  }[],
  functions: [] as Gms2Function[],
};

const skipTokens = [
  'NaN',
  'any',
  'undefined',
  'null',
  'string',
  'number',
  'function',
  'enum',
  'true',
  'false',
  'instanceof',
  'typeof',
];

/**
 * GMEdit types that have a Typescript equivalent and can just take
 * a rename.
 */
 const typeReplacements = {
  bool: 'boolean',
  object: 'obj',
  array: 'Array',
};


function toUsableType(type: string | undefined) {
  const funcTypeMatch = type?.match(/\bfunction\s*<([^>]+)>/);
  if (funcTypeMatch) {
    // just lists types without arg names, which doesn't work in typescript
    const params = funcTypeMatch[1]
      .split(',')
      .map((t, i) => `arg${i}:${t}`)
      .join(',');
    type = type!.replace(funcTypeMatch[0], `((${params})=>any)`);
  }
  type = type?.replace(/\bobject\b/g, 'obj');
  type = type?.replace(/\barray\b/g, 'Array');
  // @ts-expect-error
  return type ? typeReplacements[type] || type : 'any';
}

function addType(theType: string, sample?: string) {
  if (!theType) {
    return;
  }
  // Clean it up
  theType = theType.replace(/<[^>]+>/g, '').replace(/\[\]/g, '');
  // Handle union types
  const union = theType.split('|');
  if (union.length > 1) {
    union.forEach((t) => addType(t, sample));
    return;
  }
  theType = theType.replace(/=.*/g, '');
  if (theType.match(/\b[TKV]\d?\b/)) {
    return;
  }
  theType = theType.replace(/[<>]/g, '');
  if (skipTokens.includes(theType)) {
    return;
  }
  globals.types[theType] ||= [];
  if (sample) {
    globals.types[theType].push(sample);
  }
}

// Process apiFiles
for (const patchFile of config.patchFiles) {
  console.log({ patchFile });
  const filePath = path.join(gmeditConfigDir, patchFile);
  if (!existsSync(filePath)) {
    console.error(`GMEdit file ${patchFile} does not exist`);
    continue;
  }

  const content = readFileSync(filePath, 'utf8').replace(
    /^[^\n]*?[?]{2}.*?(\r?\n){2}/gms,
    '',
  );

  for (let line of content.split(/[\r\n]+/)) {
    // Remove comments and obsolete stuff
    if (!line?.trim() || line.match(/^([#/]|.*&)/)) {
      continue;
    }
    // Remove things we don't care about
    // $: us-spelling; £: uk-spelling, !: disallowed
    line = line.replace(/[$£!]/g, '');
    // Remove range indicators in form "[number..number]"
    line = line.replace(/\[\d+\.\.\d+\]/g, '');

    // Parse the line!
    const nonFunctionPattern =
      /^(?<name>\w+)(?<isReadOnly>[#*])?(?<propStruct>[%?])?(?<isInstanceVar>@)?(:(?<type>[\w|,<>[\]]+))?(\s*\/\/.*)?\s*$/;

    let match = line.match(nonFunctionPattern);
    if (match) {
      const parts = match.groups!;
      if (parts.propStruct) {
        console.log(match.groups);
        assert(false, `Unknown variable type`);
      }

      const alreadyFound = globals.variables.find((v) => v.name === parts.name);
      if (alreadyFound) {
        continue;
      }
      if (skipTokens.includes(parts.name)) {
        continue;
      }
      addType(parts.type, parts.name);
      globals.variables.push({
        name: parts.name,
        type: parts.type || undefined,
        isReadOnly: !!parts.isReadOnly || undefined,
        isInstance: !!parts.isInstanceVar || undefined,
      });
      continue;
    }

    const functionPattern =
      /^(?<name>\w+)\s*(<(?<generics>.+?)>)?\s*\((?<params>.*)\)\s*((->|:)\s*(?<returnType>[\w<>, ;|[\]]+))?(\s*\/\/.*)?\s*$/;

    match = line.match(functionPattern);
    if (match) {
      const funcParts = match.groups!;
      const alreadyFound = globals.functions.find(
        (f) => f.name === funcParts.name,
      );
      if (alreadyFound) {
        continue;
      }

      const generics = (
        funcParts.generics ? funcParts.generics.split(/\s*,\s*/) : []
      ).map((g) => {
        // eslint-disable-next-line
        let [name, type] = g.split(':');
        name = name?.replace(/;/g, ',');
        addType(type?.trim());
        return { name: name?.trim(), type: type?.trim() };
      });

      const params = funcParts.params
        .split(',')
        .map((p, i) => {
          let [name, type] = p.split(/\s*(?::|->)\s*/);
          name = name.trim();
          type = type?.trim().replace(/;/g, ',');
          addType(type);
          if (name.startsWith('...')) {
            type += '[]';
          }
          let optional;
          if (name.startsWith('?')) {
            name = name.substring(1);
            optional = true;
          }
          // Some params are provided only as their *generic* name,
          // instead of as a name and type. Fix that to prevent downstream issues.
          if (name.match(/^[KVT]/)) {
            type = name;
            name = `arg${i}`;
          }
          name = name == 'default' ? 'fallback' : name;
          type = toUsableType(type);
          return { name: name.replace(/\*/g, ''), type, optional };
        })
        .filter((p) => p.name);

      globals.functions.push({
        name: funcParts.name,
        generics: generics.length ? generics : undefined,
        params,
        returnType: funcParts.returnType?.trim().replace(/;/g, ','),
      });
      continue;
    }

    assert(false, `Unable to parse line: ${line}`);
  }
}

const outPath = path.join(exportRawDir, 'gml-types.json');
console.log({ outPath });
writeJSONSync(outPath, globals, { spaces: 2 });

// Write to declaration file
const declarationPath = path.join(exportRawDir, 'gml-types.d.ts');


/**
 * These will need to be populated by the assets found
 * *in the project*.
 *
 * // TODO: These need to get dumped into a file to
 * // be replaced by the actual project assets.
 */
const assetTypes = [
  'font',
  'obj',
  'path',
  'room',
  'script',
  'sequence',
  'shader',
  'sound',
  'sprite',
  'tileset',
  'timeline',
];

/**
 * Types to enable GML concepts that don't exist in Typescript to work, and to prevent other kinds of wonkiness.  */
const shims = {
  struct: 'type struct = Record<string,any>',
  int: 'type int = number',
  ds_list: 'type ds_list<T> = {private _: T[]}',
  ds_map: 'type ds_map<K extends string,V> = {private _: Record<K,V>}',
};

const replacementConstants = {
  mask_index: 'let mask_index: sprite',
  cursor_sprite: 'let cursor_sprite: sprite',
  sprite_index: 'let sprite_index: sprite',
  timeline_index: 'let timeline_index: timeline',
  room_first: 'let room_first: room',
  room_last: 'let room_last: room',
  path_index: 'let path_index: path',
};

/**
 * Some of the types that are made up of a bunch
 * of constants are sorta circularly defined.
 *
 * Specify their core types, so that all the constants
 * that claim to be of that type can be set to that value
 * instead, and then the root type can be set to the union
 * of those.
 */

const baseTypes: string[] = [];

const varTypes: string[] = [];

const funcTypes: string[] = [];


for (const typeName of Object.keys(globals.types)) {
  if (
    // @ts-expect-error
    typeReplacements[typeName] ||
    // @ts-expect-error
    shims[typeName] ||
    // @ts-expect-error
    replacementConstants[typeName]
  ) {
    continue;
  }
  if (assetTypes.includes(typeName)) {
    continue;
  }

  // If it's a nested type, need to add all of the constants
  // first to reference as a union. If the typeName shows up
  // in its own list, then it should be declared as a const
  // instead of a type.
  const definedBy = globals.types[typeName].filter((t) => t != typeName);
  if (definedBy.length) {
    // const rootType = nestedTypes[typeName];
    const isConstant = globals.types[typeName].length > definedBy.length;

    // varTypes.push(
    //   ...(definedBy.map((t) => `declare const ${t}: ${rootType};`)),
    // );

    baseTypes.push(
      `declare ${isConstant ? 'const' : 'type'} ${typeName} ${
        isConstant ? ':' : '='
      } ${definedBy.join('| ')};`,
    );
  } else {
    baseTypes.push(`declare type ${typeName} = unknown;`);
  }
}

for (const variable of Object.keys(replacementConstants)) {
  if (skipTokens.includes(variable)) {
    continue;
  }
  varTypes.push(
    // @ts-expect-error
    `declare ${replacementConstants[variable]};`,
  );
}

for (const func of globals.functions) {
  if (skipTokens.includes(func.name)) {
    continue;
  }
  let funcString = `function ${func.name}`;
  // Generics
  if (func.generics) {
    funcString += `<${func.generics
      .map((g) => {
        const type = toUsableType(g.type);
        return `${g.name}${type ? ` extends ${toUsableType(type)}` : ''}`;
      })
      .join(', ')}>`;
  }
  // Params
  funcString += `(${func.params?.map(
    (p) =>
      `${p.name}${p.optional && !p.default ? '?' : ''}${
        p.type ? `:${toUsableType(p.type)}` : ''
      }${p.default ? `=${p.default}` : ''}`,
  )})`;
  // Return
  funcString += `: ${func.returnType || 'any'}`;
  funcTypes.push(`declare ${funcString};`);
}

// Write a temp file for project assets
writeFileSync(
  path.join(exportRawDir, 'gml-project-assets.d.ts'),
  assetTypes.map((t) => `declare type ${t} = unknown;`).join('\n'),
);

// Write to declaration file
writeFileSync(
  declarationPath,
  [
    '/// <reference path="./gml-constants.d.ts" />\n',
    '// Generated by gml-types-generator.js\n',
    '//#region SHIMS\n',
    ...Object.values(shims).map((s) => `declare ${s};`),
    '////#endregion\n',
    '//#region BASE TYPES\n',
    ...baseTypes,
    '//#endregion\n',
    '//#region VARIABLE TYPES\n',
    ...varTypes,
    '//#endregion\n',
    '//#region FUNCTION TYPES\n',
    ...funcTypes,
    '////#endregion',
  ].join('\n'),
);

// // Write all of the constants to a file to run in GMS
// const constants = globals.variables.filter((v) => v.isReadOnly).map(v=>v.name);

// const structName = 'consts';
// let codeBlock = `var ${structName} = {};\n`;
// for (const constant of constants) {
//   codeBlock += `variable_struct_set(${structName},"${constant}",${constant})\n`;
// }
// writeFileSync(path.join(exportRawDir,'gml-constants.gml'),codeBlock+`show_debug_message(json_stringify(${structName}));\n`);

// //phy_particle_data_flag_colour
// //phy_particle_data_flag_color
