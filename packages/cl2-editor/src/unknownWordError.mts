import type { ParsedWord } from '@bscotch/gcdata/dist/cl2.types.editor.js';
import vscode from 'vscode';
import { range } from './quests.util.mjs';

export function unknownWordError(word: ParsedWord) {
  const err = new vscode.Diagnostic(
    range(word),
    `Unknown word: ${word.value}`,
    vscode.DiagnosticSeverity.Warning,
  );
  err.source = 'Crashlands 2 Editor';
  return err;
}
