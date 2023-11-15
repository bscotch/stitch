import { GameChanger } from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { crashlandsEvents } from './events.mjs';
import { GameChangerFs } from './gc.fs.mjs';
import { QuestCompletionProvider } from './quests.autocompletes.mjs';
import { StoryFoldingRangeProvider } from './quests.folding.mjs';
import { QuestHoverProvider } from './quests.hover.mjs';
import { QuestTreeProvider } from './quests.mjs';
import { isQuestUri, parseGameChangerUri } from './quests.util.mjs';

export class CrashlandsWorkspace {
  static workspace = undefined as CrashlandsWorkspace | undefined;
  protected constructor(
    readonly ctx: vscode.ExtensionContext,
    readonly packed: GameChanger,
  ) {}
  static async activate(ctx: vscode.ExtensionContext) {
    // Load the Packed data
    const packed = await GameChanger.from('Crashlands2');
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
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        const uri = editor?.document.uri;
        if (uri && isQuestUri(uri)) {
          crashlandsEvents.emit('quest-opened', uri, parseGameChangerUri(uri));
        }
      }),
    );

    return this.workspace;
  }
}
