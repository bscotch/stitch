import type { Asset } from '@bscotch/gml-parser';
import vscode from 'vscode';
import { assertInternalClaim } from './assert.mjs';
import { stitchEvents } from './events.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { compile, computeInitialZoom } from './spriteEditor.template.mjs';

export interface SpriteEditedMessage {
  spriteName: string;
  xorigin: number;
  yorigin: number;
  zoom: number;
}

export class StitchSpriteEditorProvider {
  public panel: vscode.WebviewPanel | undefined;
  public editing: Asset<'sprites'> | undefined;
  public zooms = new Map<Asset<'sprites'>, number>();

  constructor(readonly workspace: StitchWorkspace) {}

  protected async getWebviewContent() {
    return await compile(
      this.editing!,
      this.panel!,
      this.zooms.get(this.editing!),
    );
  }

  protected createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'stitch-sprite-editor',
      'Stitch Sprite Editor',
      vscode.ViewColumn.Active,
      { enableScripts: true },
    );

    let timeoutId: NodeJS.Timeout | null = null;
    panel.webview.onDidReceiveMessage(async (message: SpriteEditedMessage) => {
      if (message.spriteName !== this.editing?.name) return;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        const { xorigin, yorigin, zoom } = message;
        assertInternalClaim(
          typeof xorigin === 'number',
          'xorigin is not a number',
        );
        assertInternalClaim(
          typeof yorigin === 'number',
          'yorigin is not a number',
        );
        if (this.editing) {
          if (
            xorigin !== this.editing.yy.sequence.xorigin ||
            yorigin !== this.editing.yy.sequence.yorigin
          ) {
            this.editing.yy.sequence.xorigin = xorigin;
            this.editing.yy.sequence.yorigin = yorigin;
            await this.editing.saveYy();
          }
          if (zoom !== computeInitialZoom(this.editing)) {
            // Save the zoom for this sprite so it doesn't change when we re-render the editor
            this.zooms.set(this.editing, zoom);
          }
        }
      }, 50);
    });
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
    const spriteEditorProvider = new StitchSpriteEditorProvider(workspace);
    stitchEvents.on('sprite-editor-open', async (asset) => {
      await spriteEditorProvider.revealPanel(asset);
    });
    stitchEvents.on('asset-changed', async (asset) => {
      if (
        spriteEditorProvider.panel &&
        spriteEditorProvider.editing?.name === asset.name
      ) {
        await spriteEditorProvider.revealPanel(spriteEditorProvider.editing);
      }
    });
    return [];
  }
}
