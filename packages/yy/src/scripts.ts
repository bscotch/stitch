import fsp from 'node:fs/promises';
import { assert, joinPaths, parsePath } from './types/utility.js';
import { YypResource } from './types/Yyp.js';
import { Yy } from './Yy.js';

/**
 * Add a script to a project if it doesn't already exist.
 * In either case, if `content` is provided then overwrite the
 * script with whatever is in that parameter.
 */
export async function addScript(
  yypPath: string,
  scriptName: string,
  content?: string,
): Promise<{ result: 'updated' | 'created' | 'noop' }> {
  let result: 'updated' | 'created' | 'noop' = 'noop';
  assert(
    yypPath.endsWith('.yyp'),
    'First argument must be a path to a .yyp file',
  );
  assert(
    scriptName.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/),
    'Invalid script name. Must be a GameMaker-compatible name.',
  );

  const yyp = await Yy.read(yypPath, 'project');
  const projectFolder = parsePath(yypPath).parent;
  const scriptsDir = joinPaths(projectFolder, 'scripts');

  // First ensure the script files exist, since if they do
  // but are not listed in the yyp that won't break the project.
  // Don't allow same-name-different-case scenarios
  const scripts = await listYyFiles(scriptsDir);
  const matching = scripts.find(
    (script) => script.name.toLowerCase() === scriptName.toLowerCase(),
  );
  const scriptDir = joinPaths(scriptsDir, scriptName);
  const scriptYyPath = joinPaths(scriptDir, `${scriptName}.yy`);
  const scriptGmlPath = joinPaths(scriptDir, `${scriptName}.gml`);
  if (!matching) {
    // Then we'll need to create the files!
    await fsp.mkdir(scriptDir, { recursive: true });
    const yypName = parsePath(yypPath).filename;

    await Yy.write(
      scriptYyPath,
      {
        name: scriptName,
        parent: {
          name: yypName.replace(/\.yyp$/, ''),
          path: yypName,
        },
      } as any,
      'scripts',
      yyp,
    );

    // If the GML file doesn't exist, create it
    if (
      await fsp
        .stat(scriptGmlPath)
        .then(() => false)
        .catch(() => true)
    ) {
      await fsp.writeFile(scriptGmlPath, '/// ');
    }
  }
  // If content was provided, overwrite the GML file
  if (content) {
    await fsp.writeFile(scriptGmlPath, content);
    result = 'updated';
  }
  // At this point the target files exist, so we just need to
  // register it in the list of resources in the YYP if it's not already there.
  const inYyp = yyp.resources.find(
    (r) => r.id.name.toLowerCase() === scriptName.toLowerCase(),
  );
  if (!inYyp) {
    // Add it!
    const resourceEntry: YypResource = {
      id: {
        name: scriptName,
        path: `scripts/${scriptName}/${scriptName}.yy`,
      },
    };
    yyp.resources.push(resourceEntry);
    await Yy.write(yypPath, yyp, 'project');
    result = 'created';
  }

  return { result };
}

/**
 * List all yy files with the target folder that are nested one folder deep.
 * E.g. in `scripts` find `scripts/my_script/my_script.yy` etc.
 */
export async function listYyFiles(
  inFolder: string,
): Promise<{ path: string; name: string }[]> {
  const folders = await fsp.readdir(inFolder, { withFileTypes: true });
  const yyFiles: { path: string; name: string }[] = [];
  for (const folder of folders) {
    if (folder.isDirectory()) {
      const files = (
        await fsp.readdir(joinPaths(inFolder, folder.name), {
          withFileTypes: true,
        })
      ).filter((f) => f.isFile() && f.name.endsWith('.yy'));
      // Add them to the set of files, ensuring they have full paths
      if (files.length > 0) {
        yyFiles.push(
          ...files.map((f) => ({
            name: folder.name,
            path: joinPaths(inFolder, folder.name, f.name),
          })),
        );
      }
    }
  }
  return yyFiles;
}
