import fs from "../../lib/files";
import cli_assert from './cli-assert';

export type JsonifyOptions = {
  path: string
};

export default function(options: JsonifyOptions){
  cli_assert.assert(options.path, `Must provide a path. If you want to use the current directory, try "--path ."`);
  fs.convertGms2FilesToJson(options.path);
}