import { ReferenceableType, Type } from '@bscotch/gml-parser';
import vscode from 'vscode';
import type { StitchProvider } from './extension.provider.mjs';
import { locationOf } from './lib.mjs';
import {
  SemanticTokenModifier,
  SemanticTokenType,
  semanticTokensLegend,
} from './semanticTokens.mjs';

export class GameMakerSemanticTokenProvider
  implements vscode.DocumentSemanticTokensProvider
{
  constructor(readonly provider: StitchProvider) {}

  provideDocumentSemanticTokens(
    document: vscode.TextDocument,
  ): vscode.SemanticTokens | undefined {
    try {
      const file = this.provider.getGmlFile(document);
      if (!file) {
        return;
      }

      const tokensBuilder = new vscode.SemanticTokensBuilder(
        semanticTokensLegend,
      );
      const cache = new Map<
        ReferenceableType,
        { type: SemanticTokenType; mods: SemanticTokenModifier[] }
      >();
      for (const ref of file.refs) {
        // Get the location as a vscode range
        const item = ref.item;
        const range = locationOf(ref)!.range;
        // If we've already seen this symbol, use the cached semantic details
        if (cache.has(item)) {
          const { type, mods } = cache.get(item)!;
          try {
            tokensBuilder.push(range, type, mods);
          } catch (error) {
            console.error(error);
            console.error('CACHE ERROR');
            console.dir({ range, type, mods });
          }
          continue;
        }

        // Figure out what the semantic details are
        const itemType = item.$tag === 'Type' ? item : item.type;
        const tokenType = getSemanticTokenForType(itemType);
        const tokenModifiers = getSemanticModifiersForType(itemType);
        if (!tokenType) {
          console.warn('No token type for symbol', item);
          continue;
        }
        try {
          tokensBuilder.push(range, tokenType, tokenModifiers);
          cache.set(item, { type: tokenType, mods: tokenModifiers });
        } catch (err) {
          console.error(err);
          console.error('PUSH ERROR');
          console.dir({ range, tokenType, tokenModifiers });
        }
      }
      const tokens = tokensBuilder.build();
      return tokens;
    } catch (error) {
      console.error(error);
      console.error('OUTER ERROR');
    }
  }

  register() {
    return vscode.languages.registerDocumentSemanticTokensProvider(
      'gml',
      this,
      semanticTokensLegend,
    );
  }
}

function getSemanticTokenForType(type: Type): SemanticTokenType {
  switch (type.kind) {
    case 'Enum':
      return 'enum';
    case 'EnumMember':
      return 'enumMember';
    case 'Constructor':
      return 'class';
    case 'Function':
      return 'function';
    case 'Macro':
      return 'macro';
  }
  if (type.parameter) {
    return 'parameter';
  }
  return 'variable';
}

function getSemanticModifiersForType(type: Type): SemanticTokenModifier[] {
  const tokenModifiers: SemanticTokenModifier[] = [];
  if (type.native) {
    tokenModifiers.push('defaultLibrary');
  }
  if (type.global) {
    tokenModifiers.push('global');
  }
  if (!type.writable) {
    tokenModifiers.push('readonly');
  }
  if (type.local) {
    tokenModifiers.push('local');
  }
  if (type.static) {
    tokenModifiers.push('static');
  }
  if (type.kind.startsWith('Asset.')) {
    tokenModifiers.push('asset');
  }
  return tokenModifiers;
}
