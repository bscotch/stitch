import vscode from 'vscode';
import type { GameMakerFolder } from './tree.folder.mjs';

export async function promptForAssetName(startingValue?: string) {
  const options: vscode.InputBoxOptions = {
    prompt: `Asset name...`,
    validateInput(value) {
      if (!value) {
        return;
      }
      if (!value.match(/^[a-zA-Z0-9_][a-zA-Z0-9_]*/)) {
        return 'Asset names must start with a letter or underscore, and can only contain letters, numbers, and underscores.';
      }
      return;
    },
  };
  if (startingValue) {
    options.value = startingValue;
    options.valueSelection = [0, startingValue.length];
  }
  return await vscode.window.showInputBox(options);
}

export async function promptForAssetPath(startingValue?: string) {
  const options: vscode.InputBoxOptions = {
    prompt: `Provide a name for the new asset`,
    placeHolder: 'e.g. my/new/Asset',
    validateInput(value) {
      if (!value) {
        return;
      }
      if (!value.match(/^[a-zA-Z0-9_][a-zA-Z0-9_/]*/)) {
        return 'Asset names must start with a letter or underscore, and can only contain letters, numbers, and underscores.';
      }
      return;
    },
  };
  if (startingValue) {
    options.value = startingValue;
    options.valueSelection = [0, startingValue.length];
  }
  return await vscode.window.showInputBox(options);
}

export function validateFolderName(value: string | undefined) {
  if (!value) {
    return;
  }
  if (!value.match(/^[a-zA-Z0-9_][a-zA-Z0-9_/ ]*/)) {
    return 'Folder names must start with a letter or underscore, and can only contain letters, numbers, underscores, and spaces.';
  }
  return;
}

/**
 * Given a relative path and a starting folder,
 * ensure that all folders in the path exist, and return the final folder.
 */
export function ensureFolders(
  newFolderName: string,
  startFolder: GameMakerFolder,
): GameMakerFolder {
  const parts = newFolderName.split('/');
  let folder = startFolder;
  for (const part of parts) {
    folder = folder.addFolder(part);
  }
  return folder;
}

export function getPathWithSelection(from: { path: string; name: string }): {
  value: string;
  valueSelection: [number, number];
} {
  return {
    value: from.path,
    valueSelection: [from.path.length - from.name.length, from.path.length],
  };
}
