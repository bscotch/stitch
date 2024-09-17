import {
  CharacterMote,
  CharacterUpdateResult,
  isCharacterMote,
  parseStringifiedCharacter,
  stringifyCharacter,
  updateChangesFromParsedCharacter,
  type GameChanger,
} from '@bscotch/gcdata';
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
import { unknownWordError } from './unknownWordError.mjs';
import type { CrashlandsWorkspace } from './workspace.mjs';

/** Representation of an active Quest Document */
export class CharacterDocument {
  static cache = new Map<string, CharacterDocument>();

  protected constructor(
    readonly uri: vscode.Uri,
    readonly packed: GameChanger,
  ) {}
  parseResults: CharacterUpdateResult | undefined;

  get document(): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === this.uri.toString(),
    );
  }

  get moteId() {
    return parseGameChangerUri(this.uri).moteId!;
  }

  get mote(): CharacterMote {
    return this.packed.working.getMote(this.moteId)! as CharacterMote;
  }

  getAutoCompleteItems(position: vscode.Position): vscode.CompletionItem[] {
    const matchingAutocompletes = filterRanges(
      this.parseResults?.completions ?? [],
      {
        includesPosition: position,
      },
    );

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
            }
            return item;
          });
        } else if (c.type === 'glossary') {
          return [...c.options].map((o) => {
            const item = new vscode.CompletionItem(o);
            item.kind = vscode.CompletionItemKind.Text;
            item.detail = 'Glossary';
            item.insertText = o;
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
        }
        return [];
      })
      .flat();

    return completes;
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
    } else if (line.text.match(/^.(#\w+)?\s*$/)) {
      // Then we have an empty array item that we're probably wanting to delete
      newEdit.delete(this.uri, line.range);
    } else if (line.text.match(/^\t/)) {
      // Then we're at the end of a phrase group name
      // and probably want to add some dialog
      newEdit.insert(this.uri, cursor, '\n> ');
    } else if (line.text.match(/^Topic/)) {
      // Then we probably want to skip a line and create
      // a new Phrase Group
      newEdit.insert(this.uri, cursor, '\n\n\t');
    } else if (line.text.match(/^>/)) {
      // If shifted, we want to add another dialog line
      // Otherwise we want to create a new phrase group
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
    await updateChangesFromParsedCharacter(
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
      this.parseResults = parseStringifiedCharacter(content!, this.packed, {
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
        issues.push(unknownWordError(word));
      }
      diagnostics.set(this.uri, issues);
    } catch (err) {
      console.error(err);
    }
  }

  toString() {
    return stringifyCharacter(this.mote, this.packed);
  }

  static from(uri: vscode.Uri, workspace: CrashlandsWorkspace) {
    if (this.cache.has(uri.toString())) {
      return this.cache.get(uri.toString())!;
    }
    const { moteId } = parseGameChangerUri(uri);
    assertInternalClaim(moteId, 'Expected a Character mote id');
    const mote = workspace.packed.working.getMote(moteId);
    assertInternalClaim(mote, `No Character mote found with id ${moteId}`);
    assertInternalClaim(
      isCharacterMote(mote),
      'Only Characters are supported.',
    );
    const doc = new CharacterDocument(uri, workspace.packed);
    this.cache.set(uri.toString(), doc);
    doc.parse();
    return doc;
  }
}
