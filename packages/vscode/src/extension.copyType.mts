import vscode from 'vscode';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { copyToClipboard } from './lib.mjs';

export function createCopyAsTypeCallback(provider: StitchWorkspace) {
  return async () => {
    const type = await typeAtCursor(provider);
    if (type) {
      copyToClipboard(type);
    }
  };
}

export function createCopyAsJsdocSelfCallback(provider: StitchWorkspace) {
  return async () => {
    const type = await typeAtCursor(provider);
    if (type && type.match(/^(Struct|Id.Instance|Asset.GMObject)/)) {
      copyToClipboard(`/// @self ${type}`);
    } else if (type) {
      // Notify the user that this type is not a self-type
      vscode.window.showInformationMessage(
        `Type "${type}" cannot be used as a context type.`,
      );
    }
  };
}

export function createCopyAsJsdocTypeCallback(provider: StitchWorkspace) {
  return async () => {
    const type = await typeAtCursor(provider);
    if (type) {
      copyToClipboard(`/// @type {${type}}`);
    }
  };
}

/** The type of the symbol at the cursor, in Feather notation */
async function typeAtCursor(provider: StitchWorkspace) {
  const symbol = await provider.getSymbolAtCursor();
  if (!symbol) return;
  return symbol.constructs ?? symbol.type;
}
