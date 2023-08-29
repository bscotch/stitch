import { sortKeysByReference } from '@bscotch/utility';
import { Yy, type YyResourceType } from '@bscotch/yy';
import vscode from 'vscode';
import { logThrown } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import { warn } from './log.mjs';

export class StitchYyFormatProvider
  implements vscode.DocumentFormattingEditProvider
{
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    if (document.languageId !== 'yy' || !stitchConfig.enableYyFormatting) {
      warn("Not a yy file, shouldn't format");
      return;
    }
    const parts = document.uri.path.split(/[\\/]+/);
    const name = parts.at(-1)!;
    const type = name.endsWith('.yyp')
      ? 'project'
      : (parts.at(-3) as YyResourceType);
    const text = logThrown(() => document.getText());
    const start = document.positionAt(0);
    const end = document.positionAt(text.length);
    const parsed = sortKeysByReference(Yy.parse(text, type), Yy.parse(text));
    const edit = new vscode.TextEdit(
      new vscode.Range(start, end),
      Yy.stringify(parsed),
    );
    return [edit];
  }
}
