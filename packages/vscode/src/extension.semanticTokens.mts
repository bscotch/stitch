import { Flaggable, ReferenceableType } from '@bscotch/gml-parser';
import { literal } from '@bscotch/utility';
import vscode from 'vscode';
import type { StitchProvider } from './extension.provider.mjs';
import { locationOf } from './lib.mjs';
import { warn } from './log.mjs';

export type SemanticTokenType = (typeof semanticTokenTypes)[number];
export type SemanticTokenModifier = (typeof semanticTokenModifiers)[number];

const semanticTokenTypes = literal([
  'function',
  'variable',
  'enum',
  'macro',
  'class',
  'enumMember',
  'parameter',
  'property', // Self/instance variables
]);
const semanticTokenModifiers = literal([
  'readonly',
  'defaultLibrary',
  'declaration',
  'static',
  // Custom
  'local',
  'asset',
  'global',
]);

export const semanticTokensLegend = new vscode.SemanticTokensLegend(
  semanticTokenTypes,
  semanticTokenModifiers,
);

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
        { type: SemanticTokenType; mods: Set<SemanticTokenModifier> }
      >();
      for (const ref of file.refs) {
        // Get the location as a vscode range
        const item = ref.item;

        // Exclude some types that don't make sense to override
        if (
          item.name &&
          ['self', 'other', 'noone', 'all', 'global'].includes(item.name)
        ) {
          continue;
        }
        const range = locationOf(ref)!.range;
        // If we've already seen this symbol, use the cached semantic details
        if (cache.has(item)) {
          const { type, mods } = cache.get(item)!;
          try {
            tokensBuilder.push(range, type, [...mods]);
          } catch (error) {
            warn(error);
            warn('CACHE ERROR');
            console.dir({ range, type, mods });
          }
          continue;
        }

        // Figure out what the semantic details are
        const itemType = item.$tag === 'Type' ? item : item.type;
        let tokenType = getSemanticToken(item);
        if (tokenType === 'variable' && item.instance) {
          tokenType = 'property';
        }
        const tokenModifiers = updateSemanticModifiers(itemType);
        if (itemType.kind.startsWith('Asset.')) {
          tokenModifiers.add('asset');
        }
        if (item.$tag !== 'Type') {
          // Then we may have additional modifiers from the symbol
          updateSemanticModifiers(item, tokenModifiers);
        }
        if (!tokenType) {
          warn('No token type for symbol', item);
          continue;
        }
        try {
          tokensBuilder.push(range, tokenType, [...tokenModifiers]);
          cache.set(item, { type: tokenType, mods: tokenModifiers });
        } catch (err) {
          warn(err);
          warn('PUSH ERROR');
          console.dir({ range, tokenType, tokenModifiers });
        }
      }
      const tokens = tokensBuilder.build();
      return tokens;
    } catch (error) {
      warn(error);
      warn('OUTER ERROR');
    }
    return;
  }

  register() {
    return vscode.languages.registerDocumentSemanticTokensProvider(
      'gml',
      this,
      semanticTokensLegend,
    );
  }
}

function getSemanticToken(item: ReferenceableType): SemanticTokenType {
  const type = item.$tag === 'Type' ? item : item.type;
  // These take priority over the type
  if (item.parameter) {
    return 'parameter';
  }
  if (item.instance) {
    return 'property';
  }
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
  return 'variable';
}

/** Clobbers conflicting, allowing e.g. overriding type modifiers with symbol modifiers. */
function updateSemanticModifiers(
  type: Flaggable,
  modifiers = new Set<SemanticTokenModifier>(),
): Set<SemanticTokenModifier> {
  if (type.native) {
    modifiers.add('defaultLibrary');
  } else {
    modifiers.delete('defaultLibrary');
  }

  if (type.global) {
    modifiers.add('global');
    modifiers.delete('local');
  }
  if (type.local) {
    modifiers.add('local');
    modifiers.delete('global');
  }

  if (!type.writable) {
    modifiers.add('readonly');
  } else {
    modifiers.delete('readonly');
  }

  if (type.static) {
    modifiers.add('static');
  } else {
    modifiers.delete('static');
  }
  return modifiers;
}
