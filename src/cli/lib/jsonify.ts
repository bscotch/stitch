import fs from "../../lib/files";

export default function(file:string, directory?:string){
  fs.convertGms2FilesToJson(file || directory || process.cwd());
}