import type { GameMakerRelease } from '@bscotch/gamemaker-releases';
import { GameMakerIde } from '@bscotch/stitch-launcher';
import vscode, { QuickPickItemKind } from 'vscode';
import { assertUserClaim } from './assert.mjs';
import { config } from './extension.config.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { registerCommand } from './lib.mjs';

export class StitchReleasesProvider {
  constructor(readonly workspace: StitchWorkspace) {}

  static async listReleases() {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fetching GameMaker release notes...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({
          increment: 0,
        });
        const releases = await GameMakerIde.listReleases();
        progress.report({
          increment: 100,
        });
        return releases;
      },
    );
  }

  async promptToSetGameMakerVersion() {
    // Create a quickpick that lists all of the available GameMaker releases.
    const channels = config.releaseNotesChannels;
    assertUserClaim(channels.length, 'No release notes channels configured!');
    const project = this.workspace.getActiveProject();
    assertUserClaim(project, 'No active project found!');

    const releaseToQuickPickItem = (
      release: GameMakerRelease,
    ): vscode.QuickPickItem => {
      const date = new Date(release.publishedAt).toLocaleDateString(undefined, {
        dateStyle: 'short',
      });
      return {
        label: release.ide.version,
        description: `${release.channel} (${date})`,
      };
    };

    const releases = await StitchReleasesProvider.listReleases();
    const items: vscode.QuickPickItem[] = [];
    const current = releases.find((r) => r.ide.version === project.ideVersion);
    if (current) {
      const item = releaseToQuickPickItem(current);
      item.detail = `$(check) current version`;
      items.push(item, {
        label: 'IDE Versions',
        kind: QuickPickItemKind.Separator,
      });
    }
    items.push(
      ...releases
        .filter((r) => channels.includes(r.channel))
        .map((r) => {
          const date = new Date(r.publishedAt).toLocaleDateString(undefined, {
            dateStyle: 'short',
          });
          return {
            label: r.ide.version,
            description: `${r.channel} (${date})`,
          };
        }),
    );
    const choice = await vscode.window.showQuickPick(items, {
      title: `Set the GameMaker IDE version for "${project.name}"`,
      matchOnDescription: true,
    });
    if (!choice || choice.label === project.ideVersion) {
      return;
    }
    await project.setIdeVersion(choice.label);
  }

  static register(workspace: StitchWorkspace) {
    const releasesProvider = new StitchReleasesProvider(workspace);
    return [
      registerCommand('stitch.openGameMakerReleaseNotes', () => {
        vscode.env.openExternal(
          vscode.Uri.parse(
            'https://bscotch.github.io/stitch/gamemaker/releases',
          ),
        );
      }),
      registerCommand('stitch.setGameMakerVersion', async () => {
        await releasesProvider.promptToSetGameMakerVersion();
      }),
    ];
  }
}
