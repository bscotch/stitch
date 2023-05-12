import vscode from 'vscode';

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const imported = await import('./extension.provider.mjs');
  await imported.StitchProvider.activate(ctx);
}
