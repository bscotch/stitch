import { Reference, ReferenceableType } from '@bscotch/gml-parser';
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
  'deprecated',
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
        const signifier = ref.item;

        // Exclude some types that don't make sense to override
        if (
          signifier.name &&
          ['self', 'other', 'noone', 'all', 'global'].includes(signifier.name)
        ) {
          continue;
        }
        const range = locationOf(ref)!.range;
        // If we've already seen this symbol, use the cached semantic details
        if (cache.has(signifier)) {
          const { type, mods } = cache.get(signifier)!;
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
        let tokenType = inferSemanticToken(ref);
        if (tokenType === 'variable' && signifier.instance) {
          tokenType = 'property';
        }
        const tokenModifiers = inferSemanticModifiers(ref);
        const isAsset = signifier.type.type.find((t) =>
          t.kind.startsWith('Asset.'),
        );
        if (isAsset) {
          tokenModifiers.add('asset');
        }
        if (!tokenType) {
          warn('No token type for symbol', signifier);
          continue;
        }
        try {
          tokensBuilder.push(range, tokenType, [...tokenModifiers]);
          cache.set(signifier, { type: tokenType, mods: tokenModifiers });
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

function inferSemanticToken(ref: Reference): SemanticTokenType {
  const signifier = ref.item;
  const functionType = signifier.getTypeByKind('Function');

  if (signifier.getTypeByKind('Enum')) {
    return 'enum';
  }
  if (signifier.getTypeByKind('EnumMember')) {
    return 'enumMember';
  }
  if (functionType?.isConstructor) {
    return 'class';
  }
  if (functionType) {
    return 'function';
  }
  if (signifier.macro) {
    return 'macro';
  }
  if (signifier.parameter) {
    return 'parameter';
  }
  if (signifier.instance) {
    return 'property';
  }
  return 'variable';
}

/** Clobbers conflicting, allowing e.g. overriding type modifiers with symbol modifiers. */
function inferSemanticModifiers(
  ref: Reference,
  modifiers = new Set<SemanticTokenModifier>(),
): Set<SemanticTokenModifier> {
  const signifier = ref.item;
  // const isDeclaration = signifier.def?.file && ref.isDef;

  // // If only the only reference is also the declaration,
  // // then this is an unused variable.
  // const unused = isDeclaration && signifier.refs.size === 1;
  // if (unused) {
  //   modifiers.add('deprecated');
  // }

  if (signifier.native) {
    modifiers.add('defaultLibrary');
  } else {
    // modifiers.delete('defaultLibrary');
  }

  if (signifier.global) {
    modifiers.add('global');
    modifiers.delete('local');
  }
  if (signifier.local) {
    modifiers.add('local');
    modifiers.delete('global');
  }

  if (!signifier.writable) {
    modifiers.add('readonly');
  } else {
    modifiers.delete('readonly');
  }

  if (signifier.static) {
    modifiers.add('static');
  } else {
    modifiers.delete('static');
  }
  return modifiers;
}
