import vscode from 'vscode';

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const imported = await import('./extension.workspace.mjs');
  await imported.StitchWorkspace.activate(ctx);
}
