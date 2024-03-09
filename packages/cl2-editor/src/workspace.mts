import { GameChanger } from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { crashlandsEvents } from './events.mjs';
import { GameChangerFs } from './gc.fs.mjs';
import { QuestCompletionProvider } from './quests.autocompletes.mjs';
import { StoryFoldingRangeProvider } from './quests.folding.mjs';
import { QuestHoverProvider } from './quests.hover.mjs';
import { QuestWorkspaceSymbolProvider } from './quests.symbols.mjs';
import { QuestTreeProvider } from './quests.tree.mjs';
import {
  isQuestUri,
  isStorylineUri,
  parseGameChangerUri,
} from './quests.util.mjs';
import { StorylineCompletionProvider } from './storyline.autocompletes.mjs';

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

    const stringServerAuthSecretName = 'bscotch.strings.auth';

    const loadGlossary = async () => {
      const stringServerAuth = await ctx.secrets.get(
        stringServerAuthSecretName,
      );
      if (!stringServerAuth) return false;
      const { host, username, password } = JSON.parse(stringServerAuth);
      await packed.loadGlossary({ host, username, password });
      return true;
    };

    await loadGlossary();

    this.workspace = new CrashlandsWorkspace(ctx, packed);

    ctx.subscriptions.push(
      ...GameChangerFs.register(this.workspace),
      ...StoryFoldingRangeProvider.register(this.workspace),
      ...QuestTreeProvider.register(this.workspace),
      ...QuestHoverProvider.register(this.workspace),
      ...QuestCompletionProvider.register(this.workspace),
      ...StorylineCompletionProvider.register(this.workspace),
      ...QuestWorkspaceSymbolProvider.register(this.workspace),
      vscode.commands.registerCommand('crashlands.open.saveDir', async () => {
        await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.file(packed.projectSaveDir.absolute),
        );
      }),
      vscode.commands.registerCommand('bscotch.strings.reload', async () => {
        const loaded = await loadGlossary();
        assertLoudly(loaded, 'You need to activate the glossary first!');
      }),
      vscode.commands.registerCommand('bscotch.strings.logIn', async () => {
        // Get the host, username, and password
        const host = await vscode.window.showInputBox({
          prompt: 'String Server Host',
          value: 'https://strings.bscotch.net',
        });
        if (!host) return;
        const username = await vscode.window.showInputBox({
          prompt: 'Username',
        });
        if (!username) return;
        const password = await vscode.window.showInputBox({
          prompt: 'Password',
          password: true,
        });
        if (!password) return;
        // Store in secrets
        await ctx.secrets.store(
          stringServerAuthSecretName,
          JSON.stringify({ host, username, password }),
        );
        await loadGlossary();
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (isQuestUri(event.document.uri)) {
          crashlandsEvents.emit('quest-updated', event.document.uri);
        } else if (isStorylineUri(event.document.uri)) {
          crashlandsEvents.emit('storyline-updated', event.document.uri);
        }
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
