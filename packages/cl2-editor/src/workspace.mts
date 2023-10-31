import { Packed } from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { crashlandsEvents } from './events.mjs';
import { GameChangerFs } from './gc.fs.mjs';
import { QuestCompletionProvider } from './quests.autocompletes.mjs';
import { StoryFoldingRangeProvider } from './quests.folding.mjs';
import { QuestHoverProvider } from './quests.hover.mjs';
import { QuestTreeProvider } from './quests.mjs';
import { isQuestUri } from './quests.util.mjs';

export class CrashlandsWorkspace {
  static workspace = undefined as CrashlandsWorkspace | undefined;
  protected constructor(
    readonly ctx: vscode.ExtensionContext,
    readonly packed: Packed,
  ) {}
  static async activate(ctx: vscode.ExtensionContext) {
    // Load the Packed data
    const packed = await Packed.from('Crashlands2');
    assertLoudly(packed, 'Could not load packed file');

    this.workspace = new CrashlandsWorkspace(ctx, packed);

    ctx.subscriptions.push(
      ...GameChangerFs.register(this.workspace),
      ...StoryFoldingRangeProvider.register(this.workspace),
      ...QuestTreeProvider.register(this.workspace),
      ...QuestHoverProvider.register(this.workspace),
      ...QuestCompletionProvider.register(this.workspace),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (!isQuestUri(event.document.uri)) {
          return;
        }
        crashlandsEvents.emit('quest-updated', event.document.uri);
      }),
    );

    return this.workspace;
  }
}
