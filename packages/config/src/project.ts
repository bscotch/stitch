import {
  ensureGroups,
  joinPaths,
  listYyFiles,
  parsePath,
  Yy,
  YySound,
  YySprite,
} from '@bscotch/yy';
import { ok } from 'node:assert';
import fsp from 'node:fs/promises';
import {
  type StitchConfig,
  stitchConfigFilename,
  stitchConfigSchema,
} from './schema.ts';

/**
 * Ensure that any texture/audio group assignments set in the config
 * (if found) are being applied to the appropriate assets.
 */
export async function applyGroupAssignments(yypPath: string) {
  const config = await loadProjectConfig(yypPath);
  for (const kind of ['audio', 'texture'] as const) {
    // Make sure the group exists in the YYP file
    const groupNames = Object.values(config[`${kind}GroupAssignments`] || {});
    if (!groupNames.length) continue;
    await ensureGroups(yypPath, kind, groupNames);

    // For each folder in the assignment config, find all matching
    // resources and update their group. They apply by specificy, so
    // can sort them by *longest* folder and apply the first match.
    const assignments: [folder: string, group: string][] = Object.entries(
      config[`${kind}GroupAssignments`] || {},
    );
    // Sort by folder length
    assignments.sort((a, b) => b[0].length - a[0].length);
    const resourceParentFolder = joinPaths(
      parsePath(yypPath).parent,
      kind === 'audio' ? 'sounds' : 'sprites',
    );
    const yys = await listYyFiles(resourceParentFolder);
    // Try to allow for some parallelization since we have to read a LOT
    // of files.
    const waits: Promise<any>[] = [];
    for (const yyFile of yys) {
      waits.push(
        Yy.read(yyFile.path, kind === 'audio' ? 'sounds' : 'sprites').then(
          async (yy) => {
            // Start from the *end* of the assignments and apply the first
            // that matches (if any)
            for (const [targetFolder, targetGroup] of assignments) {
              const inFolder = yy.parent.path.replace(
                /^folders[/\\](.*)\.yy$/,
                '$1',
              );
              const isMatch =
                inFolder === targetFolder ||
                inFolder.startsWith(`${targetFolder}/`);
              if (!isMatch) continue;
              // Update the assigned group if it's different
              if (kind === 'audio') {
                const yySound = yy as YySound;
                if (yySound.audioGroupId.name !== targetGroup) {
                  yySound.audioGroupId = {
                    name: targetGroup,
                    path: `audiogroups/${targetGroup}`,
                  };
                  await Yy.write(yyFile.path, yySound, 'sounds');
                }
              } else {
                const yySprite = yy as YySprite;
                if (yySprite.textureGroupId.name !== targetGroup) {
                  yySprite.textureGroupId = {
                    name: targetGroup,
                    path: `texturegroups/${targetGroup}`,
                  };
                  await Yy.write(yyFile.path, yySprite, 'sprites');
                }
              }
              // No need to keep going if we got a match!
              break;
            }
          },
        ),
      );
    }
    await Promise.allSettled(waits);
  }
}

export async function ensureProjectConfig(yypPath: string): Promise<void> {
  const configPath = await findProjectConfigPath(yypPath);
  if (!(await fileExists(configPath.fullpath))) {
    await saveProjectConfig(yypPath, stitchConfigSchema.parse({}));
  }
}

/**
 * Given a path to a GameMaker project's YYP file, load
 * its Stitch Config file if it has one. Else return an
 * empty config.
 */
export async function loadProjectConfig(
  yypPath: string,
): Promise<StitchConfig> {
  const configPath = await findProjectConfigPath(yypPath);
  if (!(await fileExists(configPath.fullpath))) {
    return stitchConfigSchema.parse({});
  }
  try {
    const raw = await fsp.readFile(configPath.fullpath, 'utf8');
    return stitchConfigSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.error(
      'Failed to load existing Stitch config. Check for syntax and content errors.',
    );
    throw err;
  }
}

export async function saveProjectConfig(yypPath: string, config: StitchConfig) {
  const configPath = await findProjectConfigPath(yypPath);
  config = stitchConfigSchema.parse(config);
  await fsp.writeFile(
    configPath.fullpath,
    JSON.stringify(config, null, 2),
    'utf8',
  );
}

/**
 * Given a path to a GameMaker project's YYP file, get
 * the path to where its config file should be. Asserts
 * existence of the yyp file.
 */
export async function findProjectConfigPath(yypPath: string) {
  ok(yypPath.endsWith('.yyp'), 'Target file must be a .yyp');
  ok(await fileExists(yypPath), 'yyp file not found');
  const configFile = joinPaths(parsePath(yypPath).parent, stitchConfigFilename);
  return parsePath(configFile);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fsp.access(path);
    return true;
  } catch {
    return false;
  }
}
