import {
  QuestUpdateResult,
  isQuestMote,
  questMoteToText,
  questTextToMote,
  type Crashlands2,
  type Mote,
  type Packed,
} from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertInternalClaim } from './assert.mjs';
import { diagnostics } from './diagnostics.mjs';
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
    readonly mote: Mote<Crashlands2.Quest>,
    readonly packed: Packed,
  ) {}
  protected parseResults: QuestUpdateResult | undefined;

  get document(): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === this.uri.toString(),
    );
  }

  getAutoCompleteItems(position: vscode.Position): vscode.CompletionItem[] {
    const matchingAutocompletes = filterRanges(
      this.parseResults?.completions ?? [],
      {
        includesPosition: position,
      },
    );
    return matchingAutocompletes
      .map((c) =>
        c.options.map((o) => {
          const name = this.packed.getMoteName(o);
          const item = new vscode.CompletionItem(name);
          item.detail = this.packed.getSchema(o.schema_id)?.title;
          item.insertText = `${name}@${o.id}`;
          item.kind = vscode.CompletionItemKind.Class;
          return item;
        }),
      )
      .flat();
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
    if (line.text.match(/^.(#\w+)?\s*$/)) {
      // Then we want to replace that line with a blank one
      newEdit.delete(this.uri, line.range);
    } else if (line.text.match(/^\t(?<name>.*?)\s*(?<moteId>@[a-z_0-9]+)/)) {
      // Then we're at the end of a dialog speaker line,
      // and probably want to add some dialog
      newEdit.insert(this.uri, cursor, '\n>');
    } else if (line.text.match(/^(Start|End) Moments:/)) {
      // Then we probably want to start a dialog
      newEdit.insert(this.uri, cursor, '\n\t');
    } else if (line.text.match(/^(Start|End) Requirements:/)) {
      // Then we probably want to add a requirement
      newEdit.insert(this.uri, cursor, '\n?');
    } else if (line.text.match(/^Objectives:/)) {
      // Then we probably want to add an objective
      newEdit.insert(this.uri, cursor, '\n-');
    } else if (line.text.match(/^-/)) {
      // Then we probably want to add another objective
      newEdit.insert(this.uri, cursor, '\n-');
    } else if (line.text.match(/^(>|!|\+)/)) {
      // If shifted, we want to add another dialog line
      // Otherwise we want to create a new dialog speaker
      if (shifted) {
        newEdit.insert(this.uri, cursor, `\n${line.text[0]}`);
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

  parse(content?: string) {
    if (!content) {
      content = this.toString();
    }
    this.parseResults = questTextToMote(content, this.mote, this.packed);

    // Apply any edits
    for (const edit of this.parseResults.edits) {
      const newEdit = new vscode.WorkspaceEdit();
      newEdit.replace(this.uri, range(edit), edit.newText);
      console.log('Applying edit', edit);
      vscode.workspace.applyEdit(newEdit);
    }

    // Update diagnostics
    diagnostics.set(
      this.uri,
      this.parseResults.diagnostics.map(
        (d) =>
          new vscode.Diagnostic(
            range(d),
            d.message,
            vscode.DiagnosticSeverity.Error,
          ),
      ),
    );
  }

  toString() {
    return questMoteToText(this.mote as Mote<Crashlands2.Quest>, this.packed);
  }

  static from(uri: vscode.Uri, workspace: CrashlandsWorkspace) {
    if (this.cache.has(uri.toString())) {
      return this.cache.get(uri.toString())!;
    }
    const { moteId } = parseGameChangerUri(uri);
    assertInternalClaim(moteId, 'Expected a mote id');
    const mote = workspace.packed.getMote(moteId);
    assertInternalClaim(mote, `No mote found with id ${moteId}`);
    assertInternalClaim(isQuestMote(mote), 'Only quests are supported.');
    const doc = new QuestDocument(uri, mote, workspace.packed);
    this.cache.set(uri.toString(), doc);
    doc.parse();
    return doc;
  }
}
