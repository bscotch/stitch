import {
  Type,
  type MemberSignifier,
  type Signifier,
} from '@bscotch/gml-parser';
import vscode from 'vscode';
import { config } from './extension.config.mjs';

export function inScopeSymbolsToCompletions(
  document: vscode.TextDocument,
  items: (Signifier | MemberSignifier)[],
): vscode.CompletionItem[] {
  const completions: vscode.CompletionItem[] = [];
  for (const symbol of items) {
    if (!symbol.name) {
      continue;
    }
    const type = symbol.type;
    const location = symbol.def;
    const ignoredPrefix = config.autocompleteIgnoredPrefix;
    const shouldHide =
      ignoredPrefix &&
      symbol.name!.startsWith(ignoredPrefix) &&
      location?.file &&
      location.file.path.equals(document.uri.fsPath);
    if (shouldHide) {
      continue;
    }
    const item = new vscode.CompletionItem(
      symbol.name!,
      vscode.CompletionItemKind.Constant,
    );
    item.detail = detailsFromType(type);
    item.kind = vscodeKindFromType(type);

    completions.push(item);
  }
  return completions;
}

function detailsFromType(type: Type): string | undefined {
  const details: string[] = [type.toFeatherString()];
  if (type.native) {
    details.push('native');
  }
  if (type.global) {
    details.push('global');
  }
  if (type.local) {
    details.push('local');
  }
  if (type.parameter) {
    details.push('parameter');
  }
  if (details.length) {
    return details.join(' ');
  }
  return;
}

function vscodeKindFromType(type: Type): vscode.CompletionItemKind {
  if (type.kind === 'Enum') {
    return vscode.CompletionItemKind.Enum;
  } else if (type.kind === 'Constructor') {
    return vscode.CompletionItemKind.Constructor;
  } else if (type.kind === 'Function') {
    return vscode.CompletionItemKind.Function;
  }
  return vscode.CompletionItemKind.Variable;
}
