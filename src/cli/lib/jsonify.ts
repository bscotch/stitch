import fs from "../../lib/files";
import cli_assert from './cli-assert';

export type JsonifyOptions = {
  file?: string,
  directory? : string
};

export default function(options: JsonifyOptions){
  cli_assert.assertMutualExclusion(options.file, options.directory);
  if (options.file){
    fs.convertGms2FileToJson(options.file);
  }
  else if (options.directory){
    fs.batchConvertGms2FilesToJson(options.directory);
  }
  else{
    fs.batchConvertGms2FilesToJson(process.cwd());
  }
}