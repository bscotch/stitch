import type { Asset } from '@bscotch/gml-parser';
import vscode from 'vscode';
import spriteEditorHtml from '../webviews/sprite-editor.html';
import { stitchConfig } from './config.mjs';

export interface SpriteInfo {
  name: string;
  width: number;
  height: number;
  xorigin: number;
  yorigin: number;
  frameUrls: string[];
}

export function compile(sprite: Asset<'sprites'>, panel: vscode.WebviewPanel) {
  const data: SpriteInfo = {
    name: sprite.name,
    width: sprite.yy.width,
    height: sprite.yy.height,
    xorigin: sprite.yy.sequence.xorigin,
    yorigin: sprite.yy.sequence.yorigin,
    frameUrls: sprite.framePaths.map((p) =>
      panel.webview.asWebviewUri(vscode.Uri.file(p.absolute)).toString(),
    ),
  };
  // Inject into the HTML
  const html = spriteEditorHtml
    .replace(
      '<!-- VSCODE-INJECT-DATA -->',
      `<script>window.sprite = ${JSON.stringify(data)};</script>`,
    )
    .replace(
      './sprite-editor.js',
      panel.webview
        .asWebviewUri(
          vscode.Uri.file(
            stitchConfig.context.extensionPath + '/webviews/sprite-editor.js',
          ),
        )
        .toString(),
    );
  return html;
}
