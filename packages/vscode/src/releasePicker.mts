import { GameMakerIde } from '@bscotch/stitch-launcher';
import vscode from 'vscode';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { registerCommand, showProgress } from './lib.mjs';
import { compile } from './releasePicker.template.mjs';

export class StitchReleasePickerProvider {
  public panel: vscode.WebviewPanel | undefined;

  constructor(readonly workspace: StitchWorkspace) {}

  get projects() {
    // Sort alphabetically, but with the active project first.
    const projects = this.workspace.projects;
    const active = this.workspace.getActiveProject();
    projects.sort((a, b) => {
      if (a === active) return -1;
      if (b === active) return 1;
      return a.name.localeCompare(b.name);
    });
    return projects;
  }

  protected async getWebviewContent() {
    const releases = await StitchReleasePickerProvider.listReleases();
    return compile(releases, this.projects);
  }

  protected createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'stitch-release-picker',
      'GameMaker Version Picker',
      vscode.ViewColumn.Active,
      { enableScripts: true, enableFindWidget: true },
    );
    panel.webview.onDidReceiveMessage(
      (message: {
        type: 'toggleVersion';
        version: string;
        project: string;
      }) => {
        const project = this.projects.find((p) => p.name === message.project);
        if (!project) return;
      },
    );
    return panel;
  }

  async revealPanel() {
    this.panel ||= this.createPanel();
    this.panel.onDidDispose(() => (this.panel = undefined));
    // Rebuild the webview
    this.panel.webview.html = await this.getWebviewContent();
    this.panel.reveal();
  }

  static async listReleases() {
    const releases = await showProgress(
      () => GameMakerIde.listReleases(),
      `Fetching GameMaker release notes...`,
    );
    return releases;
  }

  static register(workspace: StitchWorkspace) {
    const releasesProvider = new StitchReleasePickerProvider(workspace);
    return [
      registerCommand('stitch.setGameMakerVersion', async () => {
        await releasesProvider.revealPanel();
      }),
    ];
  }
}
