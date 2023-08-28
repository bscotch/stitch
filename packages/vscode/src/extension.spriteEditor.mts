import type { Asset } from '@bscotch/gml-parser';
import vscode from 'vscode';
import { stitchEvents } from './events.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { compile } from './spriteEditor.template.mjs';

export class StitchSpriteEditorProvider {
  public panel: vscode.WebviewPanel | undefined;

  constructor(readonly workspace: StitchWorkspace) {}

  protected async getWebviewContent(sprite: Asset<'sprites'>) {
    return compile(sprite);
  }

  protected createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'stitch-sprite-editor',
      'Stitch Sprite Editor',
      vscode.ViewColumn.Active,
      { enableScripts: true },
    );
    panel.webview.onDidReceiveMessage(async (message: { type: string }) => {});
    return panel;
  }

  async revealPanel(sprite: Asset<'sprites'>) {
    this.panel ||= this.createPanel();
    this.panel.onDidDispose(() => (this.panel = undefined));
    // Rebuild the webview
    this.panel.webview.html = await this.getWebviewContent(sprite);
    this.panel.reveal();
  }

  static register(workspace: StitchWorkspace) {
    const releasesProvider = new StitchSpriteEditorProvider(workspace);
    stitchEvents.on('sprite-editor-open', (asset) => {
      releasesProvider.revealPanel(asset);
    });
    return [];
  }
}
