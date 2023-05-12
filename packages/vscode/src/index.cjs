/**
 * @param {import('vscode').ExtensionContext} ctx
 * @returns {Promise<void>}
 */
export async function activate(ctx) {
  const imported = await import('./extension.mjs');
  await imported.GmlProvider.activate(ctx);
}
