import vscode from 'vscode';

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const imported = await import('./workspace.mjs');
  await imported.CrashlandsWorkspace.activate(ctx);
}
