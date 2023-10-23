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
import { filterRanges, parseGameChangerUri, range } from './quests.util.mjs';
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

  parse(content?: string) {
    if (!content) {
      content = this.toString();
    }
    this.parseResults = questTextToMote(content, this.mote, this.packed);
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
