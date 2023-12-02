import {
  QuestUpdateResult,
  isQuestMote,
  parseStringifiedQuest,
  updateChangesFromParsedQuest,
  type Crashlands2,
  type GameChanger,
  type Mote,
} from '@bscotch/gcdata';
import { stringifyQuest } from '@bscotch/gcdata/dist/cl2.quest.stringify.js';
import vscode from 'vscode';
import { assertInternalClaim, assertLoudly } from './assert.mjs';
import { diagnostics } from './diagnostics.mjs';
import { crashlandsEvents } from './events.mjs';
import {
  filterRanges,
  getCursorPosition,
  parseGameChangerUri,
  range,
} from './quests.util.mjs';
import type { CrashlandsWorkspace } from './workspace.mjs';

/** Representation of an active Quest Document */
export class QuestDocument {
  static cache = new Map<string, QuestDocument>();

  protected constructor(
    readonly uri: vscode.Uri,
    readonly packed: GameChanger,
  ) {}
  parseResults: QuestUpdateResult | undefined;

  get document(): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === this.uri.toString(),
    );
  }

  get moteId() {
    return parseGameChangerUri(this.uri).moteId!;
  }

  get mote() {
    return this.packed.working.getMote(this.moteId)!;
  }

  getAutoCompleteItems(position: vscode.Position): vscode.CompletionItem[] {
    const matchingAutocompletes = filterRanges(
      this.parseResults?.completions ?? [],
      {
        includesPosition: position,
      },
    );
    // Get the character before the position. If it's an '@' then
    // we want to display ALL motes as options if we didn't get a list
    // of mote autocompletes. That way the user can still get completion
    // support for things that aren't fully implemented.
    const line = this.document!.lineAt(position.line);
    const text = line.text;
    const isAtLineStart = position.character === 0;
    const isAtTrigger = text[position.character - 1] === '@';
    const lineType = text.startsWith('>')
      ? 'dialog'
      : text.startsWith('?')
        ? 'momentStyle'
        : text.startsWith('!')
          ? 'emote'
          : 'unknown';

    const completes = matchingAutocompletes
      .map((c) => {
        if (c.type === 'motes') {
          return c.options.map((o) => {
            const name = this.packed.working.getMoteName(o)!;
            const item = new vscode.CompletionItem(name);
            item.detail = this.packed.working.getSchema(o.schema_id)?.title;
            item.insertText =
              o.schema_id === 'cl2_emoji' ? name : `${name}@${o.id}`;
            item.kind =
              o.schema_id === 'cl2_emoji'
                ? vscode.CompletionItemKind.User
                : vscode.CompletionItemKind.Class;
            // If this was an emoji autocomplete, we'll want to +1 the cursor
            // position to the right so that the cursor ends up after the ')'
            // character.
            if (o.schema_id === 'cl2_emoji') {
              item.command = {
                title: 'Move the cursor',
                command: 'cursorMove',
                arguments: [{ to: 'right' }],
              };
            } else if (lineType === 'emote') {
              // Then the next item is an emote, so we want to add ` ()` after
              // and get the cursor between the parens
              item.insertText = `${item.insertText} ()`;
              item.command = {
                title: 'Move the cursor',
                command: 'cursorMove',
                arguments: [{ to: 'left' }],
              };
            }
            return item;
          });
        } else if (c.type === 'labels') {
          return [...c.options].map((o) => {
            const item = new vscode.CompletionItem(o);
            item.kind = vscode.CompletionItemKind.Property;
            item.detail = 'Label';
            item.insertText = `${o}: `;
            item.keepWhitespace = true;
            return item;
          });
        } else if (['momentStyles', 'requirementStyles'].includes(c.type)) {
          return [...c.options].map((o) => {
            const item = new vscode.CompletionItem(o);
            item.kind = vscode.CompletionItemKind.Property;
            item.detail = 'Style';
            item.insertText = isAtLineStart ? `? ${o}` : o;
            if (c.type === 'requirementStyles' && o.startsWith('Quest')) {
              item.insertText += ': ';
            }
            return item;
          });
        }
        return [];
      })
      .flat();
    if (
      isAtTrigger &&
      !completes.find((c) => c.kind === vscode.CompletionItemKind.Class)
    ) {
      completes.push(
        ...this.packed.working.listMotes().map((mote) => {
          const name = this.packed.working.getMoteName(mote)!;
          const item = new vscode.CompletionItem(name);
          item.detail = this.packed.working.getSchema(mote.schema_id)?.title;
          item.insertText = `${name}@${mote.id}`;
          item.kind = vscode.CompletionItemKind.Class;
          // These need to delete the '@' character that triggered the autocomplete
          item.additionalTextEdits = [
            vscode.TextEdit.delete(
              new vscode.Range(
                position.translate(0, -1),
                position.translate(0, 0),
              ),
            ),
          ];
          return item;
        }),
      );
    }
    return completes;
  }

  getHover(position: vscode.Position): vscode.Hover | undefined {
    const matchingHovers = filterRanges(this.parseResults?.hovers ?? [], {
      includesPosition: position,
    });
    if (!matchingHovers[0]) {
      return;
    }
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    if (matchingHovers[0].title) {
      md.appendMarkdown(`**${matchingHovers[0].title}**\n`);
    }
    if (matchingHovers[0].description) {
      md.appendMarkdown(matchingHovers[0].description);
    }
    return new vscode.Hover(md);
  }

  onEnter(shifted?: boolean) {
    const cursor = getCursorPosition();
    if (!cursor) return;

    const newEdit = new vscode.WorkspaceEdit();

    // Get the line at this position
    const line = this.document!.lineAt(cursor.line);
    if (line.text.match(/^\/\//)) {
      // Then default to adding another comment line
      newEdit.insert(this.uri, cursor, '\n// ');
    } else if (line.text.match(/^:\)/)) {
      newEdit.insert(this.uri, cursor, '\n!');
    } else if (line.text.match(/^.(#\w+)?\s*$/)) {
      // Then we want to replace that line with a blank one
      newEdit.delete(this.uri, line.range);
    } else if (line.text.match(/^\t(?<name>.*?)\s*(?<moteId>@[a-z_0-9]+)/)) {
      // Then we're at the end of a dialog speaker line,
      // and probably want to add some dialog
      newEdit.insert(this.uri, cursor, '\n> ');
    } else if (line.text.match(/^(Start|End) Moments:/)) {
      // Then we probably want to start a dialog
      newEdit.insert(this.uri, cursor, '\n\t');
    } else if (line.text.match(/^Clue/)) {
      // Then we are probably adding dialog
      newEdit.insert(this.uri, cursor, '\n> ');
    } else if (line.text.match(/^(>|!|\?)/)) {
      // If shifted, we want to add another dialog line
      // Otherwise we want to create a new dialog speaker
      if (shifted) {
        newEdit.insert(this.uri, cursor, `\n${line.text[0]} `);
      } else {
        newEdit.insert(this.uri, cursor, '\n\n\t');
      }
    } else {
      // Then we just want to add a newline
      newEdit.insert(this.uri, cursor, '\n');
    }
    vscode.workspace.applyEdit(newEdit);
    this.parse(this.document?.getText());
  }

  /** Save the last-parsed content to the changes file */
  async save(content: string) {
    this.parse(content);
    assertLoudly(
      this.parseResults?.diagnostics.length === 0,
      'Cannot save a quest with errors.',
    );
    const nameBefore = this.packed.working.getMoteName(this.mote);
    await updateChangesFromParsedQuest(
      this.parseResults.parsed,
      this.mote.id,
      this.packed,
    );
    const nameAfter = this.packed.working.getMoteName(this.mote);
    if (nameAfter != nameBefore) {
      crashlandsEvents.emit('mote-name-changed', {
        file: this.uri,
        schemaId: this.mote.schema_id,
        moteId: this.mote.id,
        newName: this.parseResults.parsed.name,
        oldName: nameBefore,
      });
    }
  }

  parse(content?: string) {
    try {
      if (!content) {
        content = this.toString();
      }
      this.parseResults = parseStringifiedQuest(content!, this.packed, {
        checkSpelling: true,
      });

      // Apply any edits
      for (const edit of this.parseResults.edits) {
        const newEdit = new vscode.WorkspaceEdit();
        newEdit.replace(this.uri, range(edit), edit.newText);
        vscode.workspace.applyEdit(newEdit);
      }

      // Update diagnostics
      const issues = this.parseResults.diagnostics.map(
        (d) =>
          new vscode.Diagnostic(
            range(d),
            d.message,
            vscode.DiagnosticSeverity.Error,
          ),
      );
      for (const word of this.parseResults.words) {
        if (word.valid) continue;
        const diagnostic = new vscode.Diagnostic(
          range(word),
          `Unknown word: ${word.value}`,
          vscode.DiagnosticSeverity.Warning,
        );
        issues.push(diagnostic);
      }
      diagnostics.set(this.uri, issues);
    } catch (err) {
      console.error(err);
    }
  }

  toString() {
    return stringifyQuest(this.mote as Mote<Crashlands2.Quest>, this.packed);
  }

  static from(uri: vscode.Uri, workspace: CrashlandsWorkspace) {
    if (this.cache.has(uri.toString())) {
      return this.cache.get(uri.toString())!;
    }
    const { moteId } = parseGameChangerUri(uri);
    assertInternalClaim(moteId, 'Expected a mote id');
    const mote = workspace.packed.working.getMote(moteId);
    assertInternalClaim(mote, `No mote found with id ${moteId}`);
    assertInternalClaim(isQuestMote(mote), 'Only quests are supported.');
    const doc = new QuestDocument(uri, workspace.packed);
    this.cache.set(uri.toString(), doc);
    doc.parse();
    return doc;
  }
}
