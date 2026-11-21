import { channels } from '@bscotch/gamemaker-releases';
import { pathy } from '@bscotch/pathy';
import { listPaths } from '@bscotch/stitch-launcher';
import os from 'os';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { openPath, registerCommand, showProgress } from './lib.mjs';

export class StitchLocationsProvider {
  constructor(readonly workspace: StitchWorkspace) {}

  async promptForGameMakerReleaseChannel(): Promise<string | undefined> {
    // Configured channels first, then the rest
    const configured = stitchConfig.releaseNotesChannels;
    const sorted = [...channels].sort(
      (a, b) =>
        Number(!configured.includes(a.name)) -
        Number(!configured.includes(b.name)),
    );
    const picked = await vscode.window.showQuickPick(
      sorted.map((c) => ({
        label: c.title,
        description: c.name,
        channel: c.name,
      })),
      { title: 'Select a GameMaker release channel' },
    );
    return picked?.channel;
  }

  async openProjectSaveDirectory() {
    const project = this.workspace.getActiveProject();
    assertLoudly(project, 'No project found!');
    assertLoudly(
      os.platform() === 'win32',
      'Opening save directory only supported on Windows',
    );
    const saveDir = pathy(`${process.env.LOCALAPPDATA}/${project.name}`);
    await openPath(saveDir, { assertLoudly: true });
  }

  async openStitchConfigDirectory() {
    const dir = pathy(`${os.homedir()}/.stitch`);
    await openPath(dir, { assertLoudly: true });
  }

  async promptForGameMakerLocation() {
    const channel = await this.promptForGameMakerReleaseChannel();
    if (!channel) return;
    const paths = (
      await showProgress(
        () => listPaths(stitchConfig.launcherOptions),
        'Searching for paths...',
      )
    ).filter(
      // Stitch's own dirs apply to every channel
      (p) => p.exists && (!p.channels.length || p.channels.includes(channel)),
    );
    // Sort by name, and add separators between different `Whatever: ` prefixes
    paths.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
    const items: vscode.QuickPickItem[] = [];
    let lastPrefix = '';
    for (const path of paths) {
      const prefix = path.name.split(':')[0];
      if (prefix !== lastPrefix) {
        items.push({
          label: prefix,
          kind: vscode.QuickPickItemKind.Separator,
        });
        lastPrefix = prefix;
      }
      items.push({
        label: path.name,
        detail: path.description,
      });
    }
    const location = await vscode.window.showQuickPick(items, {
      title: 'Select a Location',
    });
    if (!location) return;
    const item = paths.find((p) => p.name === location.label);
    if (!item) return;
    await openPath(item.path, { assertLoudly: true });
  }

  static register(workspace: StitchWorkspace) {
    const releasesProvider = new StitchLocationsProvider(workspace);
    return [
      registerCommand('stitch.openLocation.gameMaker', () =>
        releasesProvider.promptForGameMakerLocation(),
      ),
      registerCommand('stitch.openLocation.saveDirectory', () =>
        releasesProvider.openProjectSaveDirectory(),
      ),
      registerCommand('stitch.openLocation.stitch', () =>
        releasesProvider.openStitchConfigDirectory(),
      ),
    ];
  }
}
