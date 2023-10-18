import vscode from 'vscode';

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const imported = await import('./extension.mjs');
  await imported.Cl2Workspace.activate(ctx);
}
