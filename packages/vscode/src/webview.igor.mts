import type { Asset } from '@bscotch/gml-parser';
import type {
  IgorWebviewExtensionPostRun,
  IgorWebviewPosts,
} from '@local-vscode/shared';
import vscode from 'vscode';
import html from '../webviews/build/igor.html';
import { StitchEvents, stitchEvents } from './events.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';

export class StitchIgorView {
  public panel?: vscode.WebviewPanel;
  public editing: Asset<'sprites'> | undefined;
  public zooms = new Map<Asset<'sprites'>, number>();
  protected lastRequest?: StitchEvents.RequestRunInWebview['payload'][0];

  constructor(readonly workspace: StitchWorkspace) {}

  protected getWebviewContent(panel: vscode.WebviewPanel) {
    let preparedHtml = html;
    // Add the <base> tag so that relative paths work
    const basePath = vscode.Uri.joinPath(
      this.workspace.ctx.extensionUri,
      'webviews',
      'build',
    );
    const compatibleBasePath = panel.webview.asWebviewUri(basePath);
    preparedHtml = preparedHtml.replace(
      '<head>',
      `<head><base href="${compatibleBasePath}/">`,
    );
    return preparedHtml;
  }

  protected createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'stitch-igor',
      'Igor Output',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    return panel;
  }

  revealPanel() {
    this.panel ||= this.createPanel();
    this.panel.title = 'GameMaker Runner';
    // Rebuild the webview
    this.panel.webview.html = this.getWebviewContent(this.panel!);
    this.panel.reveal();
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  async run(event: StitchEvents.RequestRunInWebview['payload'][0]) {
    this.revealPanel();
    this.lastRequest = event;
    const runMessage: IgorWebviewExtensionPostRun = {
      kind: 'run',
      runtimeVersion: event.runtime.version,
      cmd: event.cmd,
      projectName: event.project.name,
    };
    this.panel!.webview.onDidReceiveMessage(
      async (message: IgorWebviewPosts) => {
        if (message.kind === 'ready') {
          // TODO: If we don't already have a runner going, start one. On start, send stdout/stderr to the webview.
          await this.panel!.webview.postMessage(runMessage);
        }
      },
    );
  }

  static register(workspace: StitchWorkspace) {
    const spriteEditorProvider = new StitchIgorView(workspace);
    stitchEvents.on('request-run-project-in-webview', (payload) => {
      spriteEditorProvider.run(payload);
    });
    return [];
  }
}
