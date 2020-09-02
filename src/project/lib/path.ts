import path from "path";

export function ensureWin32Path (pathString:string){
  const parts = pathString.split(/[/\\]+/g);
  return path.win32.join(...parts);
}

export function ensurePosixPath (pathString:string){
  const parts = pathString.split(/[/\\]+/g);
  return path.posix.join(...parts);
}
