import { GmlSymbolType, ProjectSymbolType } from '@bscotch/gml-parser';
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
    const file = this.provider.getGmlFile(document);
    if (!file) {
      return;
    }

    const tokensBuilder = new vscode.SemanticTokensBuilder(
      semanticTokensLegend,
    );
    const cache = new Map<
      ProjectSymbolType | GmlSymbolType,
      { type: SemanticTokenType; mods: SemanticTokenModifier[] }
    >();
    for (const ref of file.refs) {
      // Get the location as a vscode range
      const symbol = ref.symbol;
      const range = locationOf(ref)!.range;
      // If we've already seen this symbol, use the cached semantic details
      if (cache.has(symbol)) {
        const { type, mods } = cache.get(symbol)!;
        tokensBuilder.push(range, type, mods);
        continue;
      }

      // Figure out what the semantic details are
      let tokenType: SemanticTokenType | undefined;
      const tokenModifiers: SemanticTokenModifier[] = [];
      if ('isDeclaration' in ref && ref.isDeclaration) {
        tokenModifiers.push('declaration');
      }
      if ('native' in symbol && symbol.native) {
        tokenModifiers.push('defaultLibrary', 'global');
      }
      switch (symbol.kind) {
        case 'enum':
          tokenType = 'enum';
          tokenModifiers.push('global');
          break;
        case 'enumMember':
          tokenType = 'enumMember';
          break;
        case 'globalFunction':
          tokenType = symbol.isConstructor ? 'class' : 'function';
          tokenModifiers.push('global');
          break;
        case 'gmlConstant':
          tokenType = 'variable';
          tokenModifiers.push('readonly');
          break;
        case 'gmlFunction':
          tokenType = 'function';
          break;
        case 'gmlVariable':
          tokenType = 'variable';
          if (symbol.definition.instance) {
            tokenType = 'property';
          }
          if (!symbol.definition.writable) {
            tokenModifiers.push('readonly');
          }
          break;
        case 'macro':
          tokenType = 'macro';
          break;
        case 'globalVariable':
          tokenType = 'variable';
          tokenModifiers.push('global');
          break;
        case 'gmlType':
          tokenType = 'class';
          break;
        case 'localVariable':
          tokenType = symbol.isParam ? 'parameter' : 'variable';
          tokenModifiers.push('local');
          break;
        case 'selfVariable':
          tokenType = 'property';
          if (symbol.isStatic) {
            tokenModifiers.push('static');
          }
          break;
      }
      tokensBuilder.push(range, tokenType, tokenModifiers);
      cache.set(symbol, { type: tokenType, mods: tokenModifiers });
    }
    return tokensBuilder.build();
  }

  register() {
    return vscode.languages.registerDocumentSemanticTokensProvider(
      'gml',
      this,
      semanticTokensLegend,
    );
  }
}
