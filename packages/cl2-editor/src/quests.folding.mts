import vscode from 'vscode';
import type { CrashlandsWorkspace } from './workspace.mjs';

export class StoryFoldingRangeProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(
    _document: vscode.TextDocument,
    _context: vscode.FoldingContext,
  ): vscode.ProviderResult<vscode.FoldingRange[]> {
    return [];
  }

  protected constructor(readonly workspace: CrashlandsWorkspace) {}
  static register(workspace: CrashlandsWorkspace) {
    const provider = new StoryFoldingRangeProvider(workspace);
    return [
      vscode.languages.registerFoldingRangeProvider(
        {
          pattern: '**/*.cl2_quest',
        },
        provider,
      ),
    ];
  }
}
