import {
  CreditsMote,
  CreditsUpdateResult,
  isCreditsMote,
  parseStringifiedCredits,
  stringifyCredits,
  updateChangesFromParsedCredits,
  type GameChanger,
} from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertInternalClaim, assertLoudly } from './assert.mjs';
import { diagnostics } from './diagnostics.mjs';
import { crashlandsEvents } from './events.mjs';
import { logger } from './log.mjs';
import {
  getCursorPosition,
  parseGameChangerUri,
  range,
} from './quests.util.mjs';
import { unknownWordError } from './unknownWordError.mjs';
import type { CrashlandsWorkspace } from './workspace.mjs';

/** Representation of an active Quest Document */
export class CreditsDocument {
  static cache = new Map<string, CreditsDocument>();

  protected constructor(
    readonly uri: vscode.Uri,
    readonly packed: GameChanger,
  ) {}
  parseResults: CreditsUpdateResult | undefined;

  get document(): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === this.uri.toString(),
    );
  }

  get moteId() {
    return parseGameChangerUri(this.uri).moteId!;
  }

  get mote(): CreditsMote {
    return this.packed.working.getMote(this.moteId)! as CreditsMote;
  }

  onEnter(shifted?: boolean) {
    const cursor = getCursorPosition();
    if (!cursor) return;

    const newEdit = new vscode.WorkspaceEdit();

    // Get the line at this position
    const line = this.document!.lineAt(cursor.line);
    if (line.text.match(/^\t/)) {
      // Then default to adding another array item
      newEdit.insert(this.uri, cursor, '\n\t- ');
    } else {
      // Default to adding a plain old newline
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
    await updateChangesFromParsedCredits(
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
      this.parseResults = parseStringifiedCredits(content!, this.packed);

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
      logger.error(err);
    }
  }

  toString() {
    return stringifyCredits(this.mote, this.packed);
  }

  static from(uri: vscode.Uri, workspace: CrashlandsWorkspace) {
    if (this.cache.has(uri.toString())) {
      return this.cache.get(uri.toString())!;
    }
    const { moteId } = parseGameChangerUri(uri);
    assertInternalClaim(moteId, 'Expected a Credits mote id');
    const mote = workspace.packed.working.getMote(moteId);
    assertInternalClaim(mote, `No Credits mote found with id ${moteId}`);
    assertInternalClaim(isCreditsMote(mote), 'Only Creditss are supported.');
    const doc = new CreditsDocument(uri, workspace.packed);
    this.cache.set(uri.toString(), doc);
    doc.parse();
    return doc;
  }
}
