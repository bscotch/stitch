import type { Asset } from '@bscotch/gml-parser';
import vscode from 'vscode';
import html from '../webviews/build/igor-out.html';
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
    // const assetPaths = html.match(/src="\/(assets\/[^"]+)"/g);
    // for (const assetPath of assetPaths || []) {
    //   // Get as a full filepath
    //   const fullPath = vscode.Uri.joinPath(
    //     this.workspace.ctx.extensionUri,
    //     'webviews-legacy/igor-out/dist/assets',
    //     assetPath,
    //   );
    //   const viewPath = this.panel!.webview.asWebviewUri(fullPath);
    //   preparedHtml = preparedHtml.replace(assetPath, `src="${viewPath}"`);
    // }
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
    this.panel.webview.html = this.getWebviewContent(this.panel!);
    this.panel.reveal();
  }

  static register(workspace: StitchWorkspace) {
    const spriteEditorProvider = new StitchIgorView(workspace);
    spriteEditorProvider.revealPanel();
    return [];
  }
}
