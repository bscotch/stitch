import type { Asset } from '@bscotch/gml-parser';
import vscode from 'vscode';
import { stitchEvents } from './events.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { compile } from './spriteEditor.template.mjs';

export class StitchSpriteEditorProvider {
  public panel: vscode.WebviewPanel | undefined;
  public editing: Asset<'sprites'> | undefined;

  constructor(readonly workspace: StitchWorkspace) {}

  protected getWebviewContent() {
    return compile(this.editing!, this.panel!);
  }

  protected createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'stitch-sprite-editor',
      'Stitch Sprite Editor',
      vscode.ViewColumn.Active,
      { enableScripts: true },
    );
    panel.webview.onDidReceiveMessage(
      async (message: {
        type: 'originChange';
        xorigin: number;
        yorigin: number;
      }) => {
        if (message.type === 'originChange') {
          const { xorigin, yorigin } = message;
          if (this.editing) {
            this.editing.yy.sequence.xorigin = xorigin;
            this.editing.yy.sequence.yorigin = yorigin;
            await this.editing.saveYy();
          }
        }
      },
    );
    return panel;
  }

  async revealPanel(sprite: Asset<'sprites'>) {
    this.editing = sprite;
    this.panel ||= this.createPanel();
    this.panel.onDidDispose(() => (this.panel = undefined));
    // Rebuild the webview
    this.panel.webview.html = await this.getWebviewContent();
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
