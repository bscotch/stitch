import { GameChanger } from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { ComfortCompletionProvider } from './comfort.autocompletes.mjs';
import { crashlandsEvents } from './events.mjs';
import { GameChangerFs } from './gc.fs.mjs';
import { logger } from './log.mjs';
import { QuestCompletionProvider } from './quests.autocompletes.mjs';
import { StoryFoldingRangeProvider } from './quests.folding.mjs';
import { QuestHoverProvider } from './quests.hover.mjs';
import { parseGameChangerUri } from './quests.util.mjs';
import { StorylineCompletionProvider } from './storyline.autocompletes.mjs';
import { SymbolProvider } from './symbols.mjs';
import { TreeProvider } from './tree.mjs';

export class CrashlandsWorkspace {
  static workspace = undefined as CrashlandsWorkspace | undefined;
  protected constructor(
    readonly ctx: vscode.ExtensionContext,
    readonly packed: GameChanger,
  ) {}
  static async activate(ctx: vscode.ExtensionContext) {
    // Load the Packed data
    const packed = await GameChanger.from('Crashlands2');
    if (!packed) {
      logger.error('Could not load packed file');
      return;
    }

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
      ...TreeProvider.register(this.workspace),
      ...QuestHoverProvider.register(this.workspace),
      ...QuestCompletionProvider.register(this.workspace),
      ...StorylineCompletionProvider.register(this.workspace),
      ...ComfortCompletionProvider.register(this.workspace),
      ...SymbolProvider.register(this.workspace),
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
      vscode.commands.registerCommand(
        'bscotch.strings.addGlossaryEntry',
        async () => {
          assertLoudly(
            this.workspace?.packed.glossary,
            'You need to activate the glossary first!',
          );
          // Find the active document, and the word under the cursor
          const editor = vscode.window.activeTextEditor;
          if (!editor) return;
          // If there is a selection, use that
          const selection = editor.selection;
          let word = editor.document.getText(selection);
          // If there is no selection, use the word under the cursor
          if (!word) {
            const position = editor.selection.active;
            const range = editor.document.getWordRangeAtPosition(position);
            if (!range) return;
            word = editor.document.getText(range);
          }
          if (!word) return;
          // Now add it to the glossary!
          await this.workspace.packed.glossary.addTerm(word);
          // Update the local glossary!
          await loadGlossary();
          // Reprocess the active document
          if (editor.document.uri.scheme === 'bschema') {
            crashlandsEvents.emit('mote-updated', editor.document.uri);
          }
        },
      ),
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
        if (event.document.uri.scheme === 'bschema') {
          crashlandsEvents.emit('mote-updated', event.document.uri);
        }
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        const uri = editor?.document.uri;
        if (uri && uri.scheme === 'bschema') {
          crashlandsEvents.emit('mote-opened', uri, parseGameChangerUri(uri));
        }
      }),
    );

    return this.workspace;
  }
}
