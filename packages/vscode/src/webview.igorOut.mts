import type { Asset } from '@bscotch/gml-parser';
import vscode from 'vscode';
import html from '../webviews/igor-out/dist/index.html';
import type { StitchWorkspace } from './extension.workspace.mjs';

export interface SpriteEditedMessage {
  spriteName: string;
  xorigin: number;
  yorigin: number;
  zoom: number;
}

export class StitchIgorView {
  public panel: vscode.WebviewPanel;
  public editing: Asset<'sprites'> | undefined;
  public zooms = new Map<Asset<'sprites'>, number>();

  constructor(readonly workspace: StitchWorkspace) {
    this.panel = this.createPanel();
  }

  protected getWebviewContent() {
    let preparedHtml = html;
    const assetPaths = html.match(/src="\/(assets\/[^"]+)"/g);
    for (const assetPath of assetPaths || []) {
      // Get as a full filepath
      const fullPath = vscode.Uri.joinPath(
        this.workspace.ctx.extensionUri,
        'webviews/igor-out/dist/assets',
        assetPath,
      );
      const viewPath = this.panel!.webview.asWebviewUri(fullPath);
      preparedHtml = preparedHtml.replace(assetPath, `src="${viewPath}"`);
    }
    return preparedHtml;
  }

  protected createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'stitch-igor-output',
      'Igor Output',
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    return panel;
  }

  async revealPanel() {
    this.panel ||= this.createPanel();
    this.panel.title = 'IGOR';
    // Rebuild the webview
    this.panel.webview.html = this.getWebviewContent();
    this.panel.reveal();
  }

  static register(workspace: StitchWorkspace) {
    const spriteEditorProvider = new StitchIgorView(workspace);
    spriteEditorProvider.revealPanel();
    return [];
  }
}
