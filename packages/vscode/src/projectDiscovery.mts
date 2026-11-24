/**
 * Finding the GameMaker project to load, and the GmlSpec files describing
 * its runtime's built-in functions.
 */
import { classifyYypPaths } from '@bscotch/gamemaker-project';
import {
  findRuntime,
  getIdeVersionDetails,
  type LauncherOptions,
} from '@bscotch/stitch-launcher';
import fs from 'node:fs/promises';
import path from 'node:path';
import vscode from 'vscode';
import { stitchConfig } from './config.mjs';
import { logger } from './log.mjs';

/**
 * Find the `.yyp` files of loadable projects in the workspace. Projects can
 * be anywhere in the workspace, not just at its root (#294). Prefabs (unless
 * enabled in the settings) and `.yyp` files nested inside another project's
 * folder are skipped (#291).
 */
export async function findWorkspaceProjects(): Promise<vscode.Uri[]> {
  const found = await vscode.workspace.findFiles('**/*.yyp');
  const includePrefabs = stitchConfig.includePrefabs;
  const classified = classifyYypPaths(found.map((uri) => uri.fsPath));
  const loadable = found.filter((_, i) => {
    const kind = classified[i].kind;
    if (kind === 'project') return true;
    if (kind === 'prefab' && includePrefabs) return true;
    logger.info(`Skipping ${kind} .yyp file`, found[i].fsPath);
    return false;
  });

  // Optionally limit to the projects listed in the settings
  const allowed = stitchConfig.allowedProjects.map((p) => p.toLowerCase());
  if (!allowed.length) return loadable;
  const matching = loadable.filter((uri) => {
    const yypName = path.basename(uri.fsPath, '.yyp').toLowerCase();
    const folderName = path.basename(path.dirname(uri.fsPath)).toLowerCase();
    return allowed.includes(yypName) || allowed.includes(folderName);
  });
  return matching.length ? matching : loadable;
}

/**
 * Choose the project to load: the only one, or the one the user picks.
 * (Only one project is loaded at a time.)
 */
export async function chooseWorkspaceProject(): Promise<
  vscode.Uri | undefined
> {
  const yypFiles = await findWorkspaceProjects();
  if (yypFiles.length <= 1) return yypFiles[0];
  const chosen = await vscode.window.showQuickPick(
    yypFiles.map((uri) => ({
      label: path.basename(uri.fsPath),
      description: vscode.workspace.asRelativePath(path.dirname(uri.fsPath)),
      uri,
    })),
    {
      title:
        'Stitch: Multiple GameMaker projects found! Choose a project to load.',
    },
  );
  return chosen?.uri;
}

async function isFile(file: string) {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

/** Find `GmlSpec.xml` files in a folder, up to a few levels deep */
async function findSpecFiles(dir: string, maxDepth = 3): Promise<string[]> {
  const found: string[] = [];
  const visit = async (current: string, depth: number) => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'gmlspec.xml') {
        found.push(full);
      } else if (entry.isDirectory() && depth < maxDepth) {
        await visit(full, depth + 1);
      }
    }
  };
  await visit(dir, 0);
  return found;
}

/**
 * Find the `GmlSpec.xml` files for a project's runtime, in this order:
 *
 * 1. The locations in the `stitch.gameMaker.gmlSpecPaths` setting (#308).
 *    Each can be a `GmlSpec.xml` file, a runtime folder, or a folder of
 *    runtimes (in which case the project's runtime version is used, if it's
 *    there).
 * 2. The project's runtime, wherever GameMaker or Stitch installed it.
 *
 * Returns an empty list if none are found, in which case the language
 * server uses the spec bundled with Stitch.
 */
export async function findGmlSpecs(options: {
  projectDir: string;
  ideVersion: string;
  runtimeVersion?: string;
  launcher: LauncherOptions;
}): Promise<string[]> {
  let runtimeVersion = options.runtimeVersion;
  const getRuntimeVersion = async () => {
    if (runtimeVersion) return runtimeVersion;
    try {
      runtimeVersion = (
        await getIdeVersionDetails(options.ideVersion, options.launcher)
      ).runtimeVersion;
    } catch (err) {
      logger.warn(
        `Could not look up the runtime for GameMaker v${options.ideVersion}`,
        err,
      );
    }
    return runtimeVersion;
  };

  // Configured locations
  const configured: string[] = [];
  for (const entry of stitchConfig.gmlSpecPaths) {
    const location = path.resolve(options.projectDir, entry);
    if (await isFile(location)) {
      configured.push(location);
      continue;
    }
    // A folder of runtimes?
    const version = await getRuntimeVersion();
    const runtimeDir = version
      ? path.join(location, `runtime-${version}`)
      : undefined;
    const inRuntime = runtimeDir ? await findSpecFiles(runtimeDir) : [];
    configured.push(
      ...(inRuntime.length ? inRuntime : await findSpecFiles(location)),
    );
  }
  if (configured.length) {
    logger.info('Using GmlSpec files from settings', configured);
    return configured;
  }

  // The installed runtime
  const version = await getRuntimeVersion();
  if (!version) return [];
  const runtime = await findRuntime(version, options.launcher).catch((err) => {
    logger.warn('Could not look up installed runtimes', err);
    return undefined;
  });
  if (!runtime) {
    logger.warn(`Runtime ${version} is not installed.`);
    return [];
  }
  const specs = await findSpecFiles(runtime.directory);
  if (!specs.length) {
    logger.warn(`No GmlSpec.xml files found in ${runtime.directory}`);
  }
  return specs;
}
