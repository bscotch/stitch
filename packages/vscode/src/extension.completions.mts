import {
  Code,
  JsdocSummary,
  Signifier,
  primitiveNames,
} from '@bscotch/gml-parser';
import vscode, { CancellationToken, CompletionContext } from 'vscode';
import { config } from './extension.config.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';

export const completionTriggerCharacters = ['.', '{', '<', '|'] as const;

export class StitchCompletionProvider implements vscode.CompletionItemProvider {
  constructor(readonly provider: StitchWorkspace) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: CancellationToken,
    context: CompletionContext,
  ): Promise<vscode.CompletionItem[] | undefined> {
    // If we're already processing this file, wait for it to finish so that we get up-to-date completions.
    await this.provider.processingFiles.get(document.uri.fsPath);
    const gmlFile = this.provider.getGmlFile(document);
    const offset = document.offsetAt(position);
    if (!gmlFile) {
      return undefined;
    }
    // Are we inside a JSDoc comment?
    const jsdoc = gmlFile.getJsdocAt(offset);
    if (jsdoc && context.triggerCharacter === '.') {
      // Then abort!
      return;
    } else if (jsdoc) {
      return jsdocCompletions(document, position, gmlFile, jsdoc);
    } else if (context.triggerCharacter === '.' || !context.triggerCharacter) {
      // Are we in a StructNewMember range?
      const inStruct = gmlFile.getStructNewMemberRangeAt(offset);
      if (inStruct) {
        return inScopeSymbolsToCompletions(
          document,
          inStruct.type.listMembers(),
        );
      }
      const items = gmlFile.getInScopeSymbolsAt(offset);
      return inScopeSymbolsToCompletions(document, items);
    }
    return undefined;
  }

  static register(provider: StitchWorkspace) {
    return vscode.languages.registerCompletionItemProvider(
      { language: 'gml', scheme: 'file' },
      new StitchCompletionProvider(provider),
      ...completionTriggerCharacters,
    );
  }
}

export function jsdocCompletions(
  document: vscode.TextDocument,
  position: vscode.Position,
  file: Code,
  jsdoc: JsdocSummary,
): vscode.CompletionItem[] {
  // For now just grab all of the global types and return them as completions.
  const completions: vscode.CompletionItem[] = [];
  const typeNames = new Set<string>(file.project.types.keys());
  for (const primitiveName of primitiveNames) {
    typeNames.add(primitiveName);
  }
  for (const type of typeNames) {
    const item = new vscode.CompletionItem(
      type,
      vscode.CompletionItemKind.Interface,
    );
    completions.push(item);
  }
  return completions;
}

export function inScopeSymbolsToCompletions(
  document: vscode.TextDocument,
  items: Signifier[],
): vscode.CompletionItem[] {
  const completions: vscode.CompletionItem[] = [];
  for (const signifier of items) {
    if (!signifier.name) {
      continue;
    }
    const location = signifier.def;
    const ignoredPrefix = config.autocompleteIgnoredPrefix;
    const shouldHide =
      ignoredPrefix &&
      signifier.name!.startsWith(ignoredPrefix) &&
      location?.file &&
      location.file.path.equals(document.uri.fsPath);
    if (shouldHide) {
      continue;
    }
    const item = new vscode.CompletionItem(
      signifier.name!,
      vscode.CompletionItemKind.Constant,
    );
    item.detail = inferDetails(signifier);
    item.kind = inferVscodeKind(signifier);

    completions.push(item);
  }
  return completions;
}

function inferDetails(signifier: Signifier): string | undefined {
  const details: string[] = [signifier.type.toFeatherString()];
  if (signifier.native) {
    details.push('native');
  }
  if (signifier.global) {
    details.push('global');
  }
  if (signifier.local) {
    details.push('local');
  }
  if (signifier.parameter) {
    details.push('parameter');
  }
  if (details.length) {
    return details.join(' ');
  }
  return;
}

function inferVscodeKind(signifier: Signifier): vscode.CompletionItemKind {
  if (signifier.getTypeByKind('Enum')) {
    return vscode.CompletionItemKind.Enum;
  }
  const functionType = signifier.getTypeByKind('Function');
  if (functionType?.isConstructor) {
    return vscode.CompletionItemKind.Constructor;
  } else if (functionType) {
    return vscode.CompletionItemKind.Function;
  }
  return vscode.CompletionItemKind.Variable;
}
