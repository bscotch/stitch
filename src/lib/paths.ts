import path from "path";

function pathSpecificitySort(path1:string,path2:string){
  const path1Parts = path1.split(/[\\/]+/);
  const path2Parts = path2.split(/[\\/]+/);
  if(path1Parts.length != path2Parts.length){
    return path2Parts.length - path1Parts.length;
  }
  // Sort alphabetically but by folder
  for(let i=0; i<path1Parts.length; i++){
    const part1 = path1Parts[i].toLowerCase();
    const part2 = path2Parts[i].toLowerCase();
    if(part1==part2){
      continue;
    }
    return part1 < part2 ? -1 : 1;
  }
  return 0;
}

export default {
  ...path,
  pathSpecificitySort
};
