import vscode from 'vscode';
import { GmlProvider } from './language.js';
import { parseSpec } from './spec.js';

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const provider = new GmlProvider(await parseSpec());
  ctx.subscriptions.push(
    vscode.languages.registerHoverProvider('gml', provider),
    vscode.languages.registerCompletionItemProvider('gml', provider, '.', '"'),
    vscode.languages.registerSignatureHelpProvider('gml', provider, '(', ','),
    vscode.languages.registerDocumentFormattingEditProvider('jsonc', provider),
    vscode.languages.registerDefinitionProvider('gml', provider),
    vscode.languages.registerReferenceProvider('gml', provider),
  );

  const onChangeDoc = debounce((event: vscode.TextDocumentChangeEvent) => {
    const doc = event.document;
    if (doc.languageId !== 'gml') {
      return;
    }
    provider.updateFile(event.document);
  }, 100);

  vscode.workspace.onDidChangeTextDocument(onChangeDoc);

  const yypFiles = await vscode.workspace.findFiles(`**/*.yyp`);
  for (const yypFile of yypFiles) {
    const project = await provider.loadProject(yypFile);
  }
}
