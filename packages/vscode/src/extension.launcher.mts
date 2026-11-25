/**
 * @file VS Code UI for `@bscotch/stitch-launcher`: settings migration,
 * actionable errors, and managing Stitch's cache of GameMaker IDEs.
 */
import {
  checkSystemRequirements,
  getIdeCacheInfo,
  isLauncherError,
  pruneIdeCache,
  restoreUpdatePrompts,
  type CachedIdeWithSize,
  type RequirementGroup,
} from '@bscotch/stitch-launcher';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vscode from 'vscode';
import {
  hasLegacyChannelNames,
  migrateChannelNames,
  stitchConfig,
} from './config.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { registerCommand, showProgress } from './lib.mjs';
import { logger, showErrorMessage } from './log.mjs';

const channelsSetting = 'gameMaker.releases.notes.channels';

/**
 * Rewrite settings that use pre-v2 GameMaker channel names
 * (`stable`, `lts`), wherever they're set.
 */
export async function migrateLauncherSettings() {
  const config = vscode.workspace.getConfiguration('stitch');
  const inspected = config.inspect<string[]>(channelsSetting);
  const scopes = [
    [inspected?.globalValue, vscode.ConfigurationTarget.Global],
    [inspected?.workspaceValue, vscode.ConfigurationTarget.Workspace],
  ] as const;
  for (const [value, target] of scopes) {
    if (Array.isArray(value) && hasLegacyChannelNames(value)) {
      const migrated = migrateChannelNames(value);
      logger.info(
        `Migrating ${channelsSetting} from ${JSON.stringify(value)} to ${JSON.stringify(migrated)}`,
      );
      await config.update(channelsSetting, migrated, target);
    }
  }
}

/**
 * Run on activation: migrate settings, and restore any GameMaker update
 * settings left changed by a previous session (including the old
 * launcher's leftovers).
 */
export async function initializeLauncher() {
  try {
    await migrateLauncherSettings();
  } catch (err) {
    logger.warn('Could not migrate GameMaker settings', err);
  }
  try {
    await restoreUpdatePrompts(stitchConfig.launcherOptions);
  } catch (err) {
    logger.warn('Could not restore GameMaker update settings', err);
  }
}

/** Requirement groups already found to be satisfied this session */
const satisfiedRequirements = new Set<RequirementGroup>();

/**
 * Make sure the system packages and tools GameMaker needs (on Linux) are
 * installed. If some are missing, offer to install them in a terminal
 * (where the user enters their own sudo password).
 *
 * @returns Whether to go ahead: `true` if everything is present or the
 * user chose to continue anyway.
 */
export async function ensureSystemRequirements(
  groups: RequirementGroup[],
  purpose: string,
): Promise<boolean> {
  const needed = groups.filter((g) => !satisfiedRequirements.has(g));
  if (!needed.length) return true;
  let report;
  try {
    report = await checkSystemRequirements(
      needed,
      stitchConfig.launcherOptions,
    );
  } catch (err) {
    logger.warn('Could not check GameMaker system requirements', err);
    return true;
  }
  if (report.note) logger.warn(report.note);
  if (!report.missing.length) {
    if (!report.note) needed.forEach((g) => satisfiedRequirements.add(g));
    return true;
  }

  const names = report.missing.map((r) =>
    r.kind === 'apt' ? (r.installName ?? r.packages[0]) : r.id,
  );
  logger.warn(
    `Missing GameMaker requirements for ${purpose}:`,
    report.missing.map((r) => `${r.id} (${r.description})`),
  );
  const install = 'Install in terminal';
  const copy = 'Copy install script';
  const anyway = 'Continue anyway';
  const choice = await vscode.window.showWarningMessage(
    `GameMaker needs some system packages and tools for ${purpose} that aren't installed: ${names.join(', ')}.${report.installScript ? ' Stitch can install them (you will be asked for your password).' : ''}${report.note ? ` ${report.note}` : ''}`,
    ...(report.installScript ? [install, copy] : []),
    anyway,
  );
  if (choice === install && report.installScript) {
    const script = path.join(os.tmpdir(), 'stitch-gamemaker-requirements.sh');
    await writeFile(script, report.installScript, { mode: 0o755 });
    const terminal = vscode.window.createTerminal({
      name: 'GameMaker requirements',
    });
    terminal.show();
    terminal.sendText(`bash '${script.replace(/'/g, `'\\''`)}'`);
    void vscode.window.showInformationMessage(
      `Installing GameMaker requirements in the terminal. Try again once it's done.`,
    );
    return false;
  }
  if (choice === copy && report.installScript) {
    await vscode.env.clipboard.writeText(report.installScript);
    void vscode.window.showInformationMessage(
      'Copied the install script. Run it in a terminal, then try again.',
    );
    return false;
  }
  return choice === anyway;
}

/**
 * Show a launcher error, offering fixes where there are any. Rethrows
 * anything that isn't a launcher error.
 */
export async function showLauncherError(err: unknown): Promise<void> {
  if (isLauncherError(err, 'VC_RUNTIME_MISSING')) {
    const installer = err.data.installerPath;
    const run = 'Run GameMaker installer';
    const choice = await showErrorMessage(
      `GameMaker needs the Microsoft Visual C++ runtime, which isn't installed. Running the official GameMaker installer once (as a normal install) installs it. Stitch's own copy of GameMaker isn't affected.`,
      ...(installer ? [run] : []),
    );
    if (choice === run && installer) {
      // Via the shell, so Windows can ask for admin rights
      await vscode.env.openExternal(vscode.Uri.file(installer));
    }
    return;
  }
  if (
    isLauncherError(err, 'UNPACKER_MISSING') ||
    isLauncherError(err, 'UNPACKER_INCAPABLE')
  ) {
    // Only Windows and macOS need an external unpacker (7-Zip)
    const open = `Open ${err.data.tool} download page`;
    const copy = 'Copy install command';
    const settings = `Set ${err.data.tool} path`;
    const choice = await showErrorMessage(err.message, open, copy, settings);
    if (choice === open) {
      await vscode.env.openExternal(vscode.Uri.parse(err.data.downloadUrl));
    } else if (choice === copy) {
      await vscode.env.clipboard.writeText(err.data.installCommand);
      void vscode.window.showInformationMessage(
        `Copied "${err.data.installCommand}". Run it in a terminal, then try again.`,
      );
    } else if (choice === settings) {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'stitch.gameMaker.launcher.sevenZipPath',
      );
    }
    return;
  }
  if (isLauncherError(err, 'IDE_NOT_INSTALLABLE')) {
    const pick = 'Set GameMaker version';
    const choice = await showErrorMessage(err.message, pick);
    if (choice === pick) {
      await vscode.commands.executeCommand('stitch.setGameMakerVersion');
    }
    return;
  }
  if (isLauncherError(err)) {
    void showErrorMessage(err.message);
    return;
  }
  throw err;
}

function formatBytes(bytes: number) {
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.round(bytes / 1024 ** 2)} MB`;
}

export class StitchLauncherProvider {
  constructor(readonly workspace: StitchWorkspace) {}

  async pruneIdeCache() {
    const options = stitchConfig.launcherOptions;
    const ides = await showProgress(
      () => getIdeCacheInfo(options),
      'Checking cached GameMaker versions...',
    );
    if (!ides.length) {
      void vscode.window.showInformationMessage(
        'Stitch has no cached GameMaker versions.',
      );
      return;
    }
    const usedBy = (ide: CachedIdeWithSize) =>
      this.workspace.projects
        .filter((p) => p.ideVersion === ide.version)
        .map((p) => p.name);
    const items = ides.map((ide) => {
      const projects = usedBy(ide);
      return {
        label: ide.version,
        description: `${ide.channel} · ${formatBytes(ide.sizeBytes)}`,
        detail: [
          projects.length ? `Used by ${projects.join(', ')}` : '',
          ide.installable ? '' : '⚠ Not available for download anymore',
        ]
          .filter(Boolean)
          .join(' · '),
        ide,
      };
    });
    const selected = await vscode.window.showQuickPick(items, {
      title: 'Select cached GameMaker versions to delete',
      canPickMany: true,
      matchOnDescription: true,
    });
    if (!selected?.length) return;

    const total = selected.reduce((sum, s) => sum + s.ide.sizeBytes, 0);
    const confirm = 'Delete';
    const choice = await vscode.window.showWarningMessage(
      `Delete ${selected.length} cached GameMaker version${selected.length === 1 ? '' : 's'} (${formatBytes(total)})?`,
      { modal: true },
      confirm,
    );
    if (choice !== confirm) return;

    const notInstallable = selected.filter((s) => !s.ide.installable);
    let includeNotInstallable = false;
    if (notInstallable.length) {
      const anyway = 'Delete anyway';
      includeNotInstallable =
        (await vscode.window.showWarningMessage(
          `These versions can't be downloaded anymore, so they can't be reinstalled once deleted: ${notInstallable.map((s) => s.label).join(', ')}.`,
          { modal: true },
          anyway,
        )) === anyway;
    }
    const versions = selected
      .filter((s) => s.ide.installable || includeNotInstallable)
      .map((s) => s.ide.version);
    if (!versions.length) return;
    const removed = await showProgress(
      () => pruneIdeCache(versions, { ...options, includeNotInstallable }),
      'Deleting cached GameMaker versions...',
    );
    logger.info('Removed from the GameMaker IDE cache:', removed);
    void vscode.window.showInformationMessage(
      `Deleted ${versions.length} cached GameMaker version${versions.length === 1 ? '' : 's'}.`,
    );
  }

  static register(workspace: StitchWorkspace) {
    const provider = new StitchLauncherProvider(workspace);
    void initializeLauncher();
    return [
      registerCommand('stitch.gameMaker.pruneIdeCache', () =>
        provider.pruneIdeCache().catch(showLauncherError),
      ),
    ];
  }
}
