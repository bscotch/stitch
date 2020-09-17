#!/usr/bin/env node
import commander from "commander";
import fs from "../lib/files";
import { oneline } from "../lib/strings";

export const cli = commander;

function jsonify(){
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
  fs.convertGms2FilesToJson(cli.file || cli.directory || process.cwd());
}

jsonify();
