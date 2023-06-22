import { YySprite } from '@bscotch/yy';
import vscode from 'vscode';
import type { StitchProvider } from './extension.provider.mjs';

export class GameMakerHoverProvider implements vscode.HoverProvider {
  constructor(readonly provider: StitchProvider) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    const item = this.provider.getSymbol(document, position);
    if (!item) {
      return;
    }
    const type = item.$tag === 'Type' ? item : item.type;
    const hoverContents = new vscode.MarkdownString();
    let hasSomething = false;
    const code = type.code;
    if (code) {
      hoverContents.appendCodeblock(type.code, 'gml');
      hasSomething = true;
    }
    const description = item.description || type.description;
    if (description) {
      hoverContents.appendMarkdown(description);
      hasSomething = true;
    }
    if (type.details) {
      hoverContents.appendMarkdown(type.details);
      hasSomething = true;
    }
    // If it's a sprite, add preview images
    const sprite =
      type.kind === 'Asset.GMSprite' &&
      item.name &&
      this.provider.getAsset(document, item.name);
    if (sprite) {
      hoverContents.isTrusted = true;
      hoverContents.baseUri = vscode.Uri.file(sprite.dir.absolute);
      hoverContents.supportHtml = true;
      const yy = sprite.yy as YySprite;
      let images = '';
      for (const frame of yy.frames) {
        const framePath = vscode.Uri.file(
          sprite.dir.join(`${frame.name}.png`).absolute,
        );
        images += `![Sprite subimage](${framePath})`;
      }
      hoverContents.appendMarkdown(images);
      hasSomething = true;
    }

    if (!hasSomething) {
      return;
    }
    // console.log('Hovering over', item);
    return new vscode.Hover(hoverContents);
  }

  static register(provider: StitchProvider) {
    return vscode.languages.registerHoverProvider(
      'gml',
      new GameMakerHoverProvider(provider),
    );
  }
}
