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
const exportDir = 'assets';

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

function addType(theType: string, sample?: string) {
  if (theType) {
    // Clean it up
    theType = theType.replace(/<[^>]+>/g, '').replace(/\[\]/g, '');
    // Handle union types
    const union = theType.split('|');
    if (union.length > 1) {
      union.forEach((t) => addType(t, sample));
      return;
    }
    if(theType.match(/\bT\d?\b/)){
      return;
    }
    globals.types[theType] ||= [];
    if (sample) {
      globals.types[theType].push(sample);
    }
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
        const [name, type] = g.split(':');
        addType(type);
        return { name, type };
      });

      const params = funcParts.params.split(',').map((p) => {
        let [name, type] = p.split(/\s*:\s*/);
        addType(type);
        if(name.startsWith('...')){
          type += '[]';
        }
        return { name, type };
      }).filter((p) => p.name);

      // const func = (line.includes('->') ? line.replace("->",":") : `${line}:any`).trim();

      globals.functions.push({
        name: funcParts.name,
        generics: generics.length ? generics : undefined,
        params,
        returnType: funcParts.returnType?.trim(),
      });
      continue;
    }

    assert(false, `Unable to parse line: ${line}`);
  }
}

// TODO:
// - Handle default and optional params
// - Handle generics
// - Capture all types and figure out how to declare them
const outPath = path.join(exportDir, 'exported-types.json');
console.log({ outPath });
writeJSONSync(outPath, globals, { spaces: 2 });
