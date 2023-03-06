import fs from 'fs-extra';
import path from 'path';

const sandboxRoot = './sandbox';
const samplesRoot = './samples';
export function resetSandbox() {
  fs.ensureDirSync(sandboxRoot);
  try {
    fs.emptyDirSync(sandboxRoot);
  } catch (err) {
    console.log(err);
  }
  fs.copySync(samplesRoot, sandboxRoot);
}
export function samplesPath(...subPathParts: string[]) {
  return path.join(samplesRoot, ...(subPathParts || []));
}
export function sandboxPath(...subPathParts: string[]) {
  return path.join(sandboxRoot, ...(subPathParts || []));
}
