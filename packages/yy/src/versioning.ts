import fsp from 'node:fs/promises';
import { assert, joinPaths, parsePath } from './types/utility.js';

const platformNames = [
  'amazonfire',
  'android',
  'html5',
  'ios',
  'linux',
  'mac',
  'operagx',
  'ps4',
  'switch',
  'tvos',
  'windows',
  'windowsuap',
  'xbone',
  'xboxseriesxs',
];

/**
 * Set the project version in all options files.
 * (Note that the Switch options files do not include the version
 *  -- that must be set outside of GameMaker in the *.nmeta file).
 * Can use one of:
 *    + "0.0.0.0" syntax (exactly as GameMaker stores versions)
 *    + "0.0.0" syntax (semver without prereleases -- the 4th value will always be 0)
 *    + "0.0.0-rc.0" syntax (the 4th number will be the RC number)
 * The four numbers will appear in all cases as the string "major.minor.patch.candidate"
 */
export async function setProjectVersion(
  yypPath: string,
  versionString: string,
) {
  assert(
    yypPath.endsWith('.yyp'),
    'First argument must be a path to a .yyp file',
  );
  const projectFolder = parsePath(yypPath).parent;
  const parts = versionString.match(
    /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)((\.(?<revision>\d+))|(-rc.(?<candidate>\d+)))?$/,
  );
  if (!parts) {
    throw new Error(`Version string ${versionString} is not a valid format.`);
  }
  const { major, minor, patch, revision, candidate } = parts.groups as {
    [part: string]: string;
  };
  const normalizedVersionString = [
    major,
    minor,
    patch,
    candidate || revision || '0',
  ].join('.');
  const optionsDir = joinPaths(projectFolder, 'options');
  const optionsFiles = await listFiles(optionsDir, ['.yy', '.nmeta']);
  for (const file of optionsFiles) {
    // Load it, change the version, and save
    const parsedPath = parsePath(file);
    if (parsedPath.ext == '.yy') {
      // Read the file and replace anything that looks like a version line with the provided version. A version line looks like "option_..._version":"x.y.z.w"
      const content = await fsp.readFile(file, 'utf8');
      const newContent = content.replace(
        new RegExp(
          `("option[^"]*(?:${platformNames.join('|')})_version":\\s*")[\\d.]+"`,
        ),
        `$1${normalizedVersionString}"`,
      );
      await fsp.writeFile(file, newContent);
    }
    // Switch *.nmeta file needs special treatment
    else if (parsedPath.ext == '.nmeta') {
      // Uses an XML-ish format
      const switchSearchRegex = new RegExp(
        `(?<pre><DisplayVersion>)(?<versionString>.*)(?<post></DisplayVersion>)`,
      );
      const content = await fsp.readFile(file, 'utf8');
      const newContent = content.replace(
        switchSearchRegex,
        `$1${normalizedVersionString}$3`,
      );
      await fsp.writeFile(file, newContent);
    }
  }
}

/**
 * Get the files found in `dir`, recursively, as full paths. Only include
 * specified extensions.
 */
async function listFiles(
  dir: string,
  allowedExtensions: `.${string}`[],
): Promise<string[]> {
  let results: string[] = [];
  const list = await fsp.readdir(dir, { withFileTypes: true });
  for (const dirent of list) {
    const fullPath = joinPaths(dir, dirent.name);
    if (dirent.isDirectory()) {
      results = results.concat(await listFiles(fullPath, allowedExtensions));
    } else if (allowedExtensions.includes(parsePath(dirent.name).ext)) {
      results.push(fullPath);
    }
  }
  return results;
}
