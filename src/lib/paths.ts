import nodePath from "path";

/**
 * Pass to `.sort()` got an array of paths to get
 * them sorted by *least* to *most* specific (i.e.
 * fewest to most subdirs) and alphabetically by
 * directory within a specificity tier.
 */
function pathSpecificitySort(path1:string,path2:string){
  const path1Parts = path1.split(/[\\/]+/);
  const path2Parts = path2.split(/[\\/]+/);
  if(path1Parts.length != path2Parts.length){
    return path1Parts.length - path2Parts.length;
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

/**
 * Given a path, return all of the parent paths
 * leading up to it. Sorted by least to most specific
 * (e.g. /hello comes before /hello/world)
 */
function heirarchy(path:string){
  const paths:string[] = [path];
  while(nodePath.dirname(path) != path){
    path = nodePath.dirname(path);
    paths.push(path);
  }
  paths.reverse();
  return paths.filter(p=>p!='.');
}

export default {
  ...nodePath,
  pathSpecificitySort,
  heirarchy,
};
