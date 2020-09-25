#!/usr/bin/env node
import commander from "commander";
import { oneline } from "../lib/strings";
import jsonify, {JsonifyOptions} from './lib/jsonify';

const cli = commander;

cli.description("Convert every .yy and .yyp file into valid JSON.")
  .option("--directory <path>", oneline`
    Directory to begin (recursive) search for files to jsonify.
    If neither this nor --file is set, defaults to cwd.
  `)
  .option("--file <path>", oneline`
    Single file to convert. If not set, will recursively convert
    all files in --directory or cwd.
  `)
  .parse(process.argv);

jsonify(cli as JsonifyOptions);
