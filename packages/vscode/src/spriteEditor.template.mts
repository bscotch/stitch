import {
  summarizeSpine,
  type Asset,
  type SpineSummary,
} from '@bscotch/gamemaker-project';
import path from 'node:path';
import fsp from 'node:fs/promises';
import vscode from 'vscode';
import spineEditorHtml from '../webviews-legacy/spine-editor.html';
import spriteEditorHtml from '../webviews-legacy/sprite-editor.html';
import { stitchConfig } from './config.mjs';
import { logger } from './log.mjs';

export interface SpriteInfo {
  name: string;
  width: number;
  height: number;
  xorigin: number;
  yorigin: number;
  frameUrls: string[];
  zoom: number;
}

export interface SpineSpriteInfo {
  name: string;
  width: number;
  height: number;
  xorigin: number;
  yorigin: number;
  spine: {
    atlas: string;
    json: string;
  };
  /** To get around URI management in the webpage, just create data URLs. Fields are the filenames, which should exactly match the filenames in the 'spine' section */
  spineDataUris: {
    [key: string]: string;
  };
  summary: SpineSummary;
}

export function computeInitialZoom(sprite: Asset<'sprites'>) {
  return Math.max(
    stitchConfig.initialMinSpriteEditorWidth / sprite.yy.width,
    Math.min(512 / sprite.yy.width, 1),
  );
}

function compileRegularSprite(
  sprite: Asset<'sprites'>,
  panel: vscode.WebviewPanel,
  defaultZoom?: number,
) {
  const data: SpriteInfo = {
    name: sprite.name,
    width: sprite.yy.width,
    height: sprite.yy.height,
    xorigin: sprite.yy.sequence.xorigin,
    yorigin: sprite.yy.sequence.yorigin,
    frameUrls: sprite.framePaths.map((p) =>
      panel.webview.asWebviewUri(vscode.Uri.file(p)).toString(),
    ),
    zoom: defaultZoom || computeInitialZoom(sprite),
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
            stitchConfig.context.extensionPath +
              '/webviews-legacy/sprite-editor.js',
          ),
        )
        .toString(),
    );
  return html;
}

async function compileSpineSprite(
  sprite: Asset<'sprites'>,
  panel: vscode.WebviewPanel,
): Promise<string> {
  const { atlas, json } = sprite.spinePaths!;

  // Add the atlas and json data URIs
  const [atlasContent, jsonContent, summary] = await Promise.all([
    fsp.readFile(atlas),
    fsp.readFile(json),
    summarizeSpine(json),
  ]);
  const data: SpineSpriteInfo = {
    name: sprite.name,
    width: sprite.yy.width,
    height: sprite.yy.height,
    xorigin: sprite.yy.sequence.xorigin,
    yorigin: sprite.yy.sequence.yorigin,
    spine: {
      // Use the basenames since we'll be using data urls
      atlas: path.basename(atlas),
      json: path.basename(json),
    },
    spineDataUris: {},
    summary,
  };

  data.spineDataUris[path.basename(atlas)] =
    `data:application/octet-stream;base64,${atlasContent.toString('base64')}`;
  data.spineDataUris[path.basename(json)] =
    `data:application/json;base64,${jsonContent.toString('base64')}`;

  // Discover the PNGs and their data URIs
  await Promise.all(
    atlasContent
      .toString('utf8')
      .split(/[\r\n]+/)
      .filter((line) => line.match(/^.*\.png$/))
      .map((name) => path.join(path.dirname(atlas), name))
      .map(async (file) => {
        let imageContent: Buffer;
        try {
          imageContent = await fsp.readFile(file);
        } catch {
          logger.warn(`Atlas references non-existent file ${file}`);
          return;
        }
        data.spineDataUris[path.basename(file)] =
          `data:image/png;base64,${imageContent.toString('base64')}`;
      }),
  );

  // const spineSummary = spineJson
  //   ? await new Spine(spineJson).summarize()
  //   : undefined;
  // Inject into the HTML
  const html = spineEditorHtml
    .replace(
      '<!-- VSCODE-INJECT-DATA -->',
      `<script>window.sprite = JSON.parse(\`${JSON.stringify(
        data,
      )}\`);</script>`,
    )
    .replace(
      './spine-editor.js',
      panel.webview
        .asWebviewUri(
          vscode.Uri.file(
            stitchConfig.context.extensionPath +
              '/webviews-legacy/spine-editor.js',
          ),
        )
        .toString(),
    );
  return html;
}

export async function compile(
  sprite: Asset<'sprites'>,
  panel: vscode.WebviewPanel,
  defaultZoom?: number,
) {
  if (sprite.isSpineSprite) {
    return await compileSpineSprite(sprite, panel);
  }
  return compileRegularSprite(sprite, panel, defaultZoom);
}
