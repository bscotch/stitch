#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline } from "@bscotch/utility";
import jsonify, {JsonifyOptions} from './lib/jsonify';

const cli = commander;

cli.description("Convert .yy and .yyp files into valid JSON.")
  .requiredOption("--path <path>", oneline`
    Path to a single file or a directory to begin (recursive) search for files to jsonify.
  `)
  .parse(process.argv);

jsonify(cli as JsonifyOptions & CommanderStatic);
