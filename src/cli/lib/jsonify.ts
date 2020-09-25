import fs from "../../lib/files";
import cli_assert from './cli-assert';

export type JsonifyOptions = {
  file?: string,
  directory? : string
};

export default function(options: JsonifyOptions){
  cli_assert.assertMutualExclusion(options.file, options.directory);
  fs.batchConvertGms2FilesToJson(options.file || options.directory || process.cwd());
}