
import JsonBig from "json-bigint";
import fs from "fs-extra";

const Json = JsonBig({useNativeBigInt:true});

export default {
  stringify(stuff:any){
    return Json.stringify(stuff,null,4).replace(/\r?\n/g,'\r\n');
  },
  parse(string:string){
    return Json.parse(string);
  },
  readFileSync(filePath:string){
    const content = fs.readFileSync(filePath,'utf8');
    return Json.parse(content);
  }
};
