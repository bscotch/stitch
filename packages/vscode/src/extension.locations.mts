import type { Channel } from '@bscotch/gamemaker-releases';
import { pathy } from '@bscotch/pathy';
import { GameMakerIde } from '@bscotch/stitch-launcher';
import os from 'os';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { openPath, registerCommand, showProgress } from './lib.mjs';

export class StitchLocationsProvider {
  constructor(readonly workspace: StitchWorkspace) {}

  async promptForGameMakerReleaseChannel() {
    const channels = stitchConfig.releaseNotesChannels;
    assertLoudly(channels.length, 'No release notes channels configured!');
    const channel = (await vscode.window.showQuickPick(channels, {
      title: 'Select a GameMaker release channel',
    })) as Channel | undefined;
    return channel;
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
    // /^GameMaker(Studio2?)?(-(Beta|LTS))?\.exe$/
    const uniquePaths = new Set<string>();
    const paths = (
      await showProgress(
        () => GameMakerIde.listWellKnownPaths(),
        'Searching for paths...',
      )
    ).filter((p) => {
      if (uniquePaths.has(p.path)) return false;
      uniquePaths.add(p.path);
      if (p.path.endsWith('.exe')) return false;
      const isLts = p.path.match(/GameMaker(Studio2?)?-LTS/);
      const isBeta = p.path.match(/GameMaker(Studio2?)?-Beta/);
      if (channel === 'lts' && isLts) return true;
      if (['unstable', 'beta'].includes(channel) && isBeta) return true;
      if (channel === 'stable' && !isLts && !isBeta) return true;
      return false;
    });
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
