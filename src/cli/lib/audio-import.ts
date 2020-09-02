import abort from "./abort";
import {Project} from "../../project/Project";
import fs from "fs-extra";
import klaw from 'klaw-sync';
import path from "path";
import chalk from "chalk";

export default function(yypPath:string,source:string){
  if(!source){
    abort("The source path is required!");
  }
  // Get the sound files
  if(!fs.existsSync(source)){
    abort(`Source does not exist: ${source}`);
  }
  const files: string[] = [];
  if(fs.statSync(source).isFile()){
    files.push(source);
  }
  else{
    let rawFiles: string[] = klaw(source)
      .filter(file=>{
        return file.stats.isFile() &&
          [".ogg",".wav",".mp3"].includes(path.parse(file.path).ext);
      })
      .map(file=>file.path);
    files.push(...rawFiles);
  }
  if(!files.length){
    abort("No sound files found in source");
  }
  try{
    const project = new Project(yypPath);
    console.log(chalk.cyan(`  Found ${files.length} audio files. Importing...`))
    for(const audioFile of files){
      project.upsertAudio(audioFile)
    }
    console.log(chalk.greenBright("Audio import complete!"));
  }
  catch(err){
    abort("Invalid path for project .yyp file.");
  }
}
