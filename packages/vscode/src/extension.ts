import vscode from 'vscode';

export async function activate(ctx: vscode.ExtensionContext) {
  const imported = await import('./extension.workspace.mjs');
  const workspace = await imported.StitchWorkspace.activate(ctx);
  // (Not a public API yet: used by integration tests)
  return { workspace };
}

export async function deactivate(): Promise<void> {
  const imported = await import('./extension.workspace.mjs');
  await imported.StitchWorkspace.deactivate();
}
