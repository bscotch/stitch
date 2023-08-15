import {
  type Asset,
  type Code,
  type Signifier,
  type Type,
} from '@bscotch/gml-parser';
import vscode from 'vscode';
import { config } from './extension.config.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { locationOf } from './lib.mjs';
import { info, warn } from './log.mjs';

type SearchMatcher = (name: string) => boolean;
type SymbolResults = Map<Signifier | Code | Asset, vscode.SymbolInformation>;

export class StitchWorkspaceSymbolProvider
  implements vscode.WorkspaceSymbolProvider
{
  constructor(readonly provider: StitchWorkspace) {}

  get projects() {
    return this.provider.projects;
  }

  protected variablesToSymbols(
    variables: Type,
    symbols: SymbolResults,
    isMatch: SearchMatcher,
  ): SymbolResults {
    // Add any variables defined in this object
    if (!variables) return symbols;
    for (const member of variables.listMembers(true)) {
      if (symbols.has(member)) continue;
      const symbol = this.signifierToSymbol(member, isMatch);
      if (symbol) {
        symbols.set(member, symbol);
      }
    }
    return symbols;
  }

  protected assetContentsToSymbols(
    resource: Asset,
    symbols: SymbolResults,
    isMatch: SearchMatcher,
  ): SymbolResults {
    const start = new vscode.Position(0, 0);

    if (resource.assetKind === 'scripts') {
      // Add the script itself
      const canAdd = isMatch(resource.name) && !symbols.has(resource);
      if (canAdd) {
        symbols.set(
          resource,
          new vscode.SymbolInformation(
            resource.name,
            vscode.SymbolKind.Module,
            resource.assetKind,
            new vscode.Location(
              vscode.Uri.file(resource.gmlFile!.path.absolute),
              start,
            ),
          ),
        );
      }
    } else if (resource.assetKind === 'objects') {
      for (const file of resource.gmlFiles.values()) {
        // Add the object event itself
        const canAdd = isMatch(resource.name) && !symbols.has(file);
        if (canAdd) {
          const symbol = new vscode.SymbolInformation(
            resource.name,
            vscode.SymbolKind.Class,
            `${resource.assetKind} (${file.path.name})`,
            new vscode.Location(vscode.Uri.file(file.path.absolute), start),
          );
          symbols.set(file, symbol);
        }

        // Add any variables defined in this object
        if (!config.symbolsIncludeInstanceVars) continue;
        this.variablesToSymbols(file.asset.variables!, symbols, isMatch);
      }
    } else {
      // Add the asset yy file for all other asset types
      const canAdd = isMatch(resource.name) && !symbols.has(resource);
      if (canAdd) {
        symbols.set(
          resource,
          new vscode.SymbolInformation(
            resource.name,
            vscode.SymbolKind.File,
            resource.assetKind,
            new vscode.Location(
              vscode.Uri.file(resource.yyPath.absolute),
              start,
            ),
          ),
        );
      }
    }
    return symbols;
  }

  protected globalsToSymbols(
    project: GameMakerProject,
    symbols: SymbolResults,
    isMatch: SearchMatcher,
  ): SymbolResults {
    for (const item of project.self.listMembers()) {
      // Assets are already handled by the resource cache.
      if (!symbols.has(item)) {
        const symbol = this.signifierToSymbol(item, isMatch);
        if (symbol) {
          symbols.set(item, symbol);
        }
      }

      // Even if the symbol itself doesn't match, it may have members that do!
      if (!config.symbolsIncludeInstanceVars) continue;

      // If it's a mixin or constructor, add its members
      const functionType = item.getTypeByKind('Function');
      if (functionType?.self && (item.mixin || functionType.isConstructor)) {
        // Add any variables defined in this object
        this.variablesToSymbols(functionType.self, symbols, isMatch);
      }
    }
    return symbols;
  }

  protected signifierToSymbol(
    item: Signifier,
    isMatch?: SearchMatcher,
  ): vscode.SymbolInformation | undefined {
    if (!item.def?.file || !item.name || (isMatch && !isMatch(item.name))) {
      return;
    }

    const type = item.type;
    const functionType = item.getTypeByKind('Function');

    const kind =
      type.kind === 'Enum'
        ? vscode.SymbolKind.Enum
        : functionType?.isConstructor
        ? vscode.SymbolKind.Constructor
        : functionType
        ? vscode.SymbolKind.Function
        : vscode.SymbolKind.Variable;
    return new vscode.SymbolInformation(
      item.name,
      kind,
      type.kind,
      locationOf(item.def)!,
    );
  }

  provideWorkspaceSymbols(query: string): vscode.SymbolInformation[] {
    if (!query?.trim()) {
      // No value in searching for nothing, unless we start doing
      // active-editor-dependent searching.
      return [];
    }
    try {
      const symbols: SymbolResults = new Map();
      query = query.trim();
      const pattern = new RegExp(query.split('').join('.*'));
      const isMatch: SearchMatcher = (name: string) =>
        this.scoreResult(query, pattern, name) > 0;

      const project = this.provider.getActiveProject();
      if (!project) {
        return [];
      }

      this.globalsToSymbols(project, symbols, isMatch);
      for (const resource of project.assets.values()) {
        this.assetContentsToSymbols(resource, symbols, isMatch);
      }
      if (config.symbolsIncludeLocalVars) {
        // Add the local variables defined in the current document
        const activeFile = this.provider.getGmlFile(undefined);
        if (activeFile) {
          for (const scope of activeFile.scopes) {
            this.variablesToSymbols(scope.local, symbols, isMatch);
          }
        }
      }

      // Sort by match quality and then only return the top results.
      const filteredSymbols = [...symbols.values()].sort(
        this.resultSorter(query, pattern),
      );
      info(`Found ${filteredSymbols.length} symbols matching "${query}"`);
      const results = filteredSymbols.slice(0, config.symbolsMaxSearchResults);
      return results;
    } catch (error) {
      warn(error);
      return [];
    }
  }

  scoreResult(query: string, pattern: RegExp, result: string) {
    // Prioritize in order of:
    // 1. Exact match
    // 2. Size of matching substring (shorter is better)
    // 3. Position of match (earlier is better)
    let score = 0;
    const patterns = [
      // pattern without case sensitivity
      new RegExp(pattern.source, 'i'),
      // pattern with case sensitivity
      // new RegExp(pattern.source),
    ];
    for (const pattern of patterns) {
      const match = result.match(pattern);
      if (!match) {
        break;
      }
      const characterProximityScore = query.length / match[0].length;
      const matchLengthScore = query.length / result.length;
      const positionScore = 1 - match.index! / result.length;
      score += characterProximityScore * 2 + positionScore + matchLengthScore;
    }
    return score;
  }

  resultSorter(query: string, pattern: RegExp) {
    return (a: { name: string }, b: { name: string }) => {
      const aScore = this.scoreResult(query, pattern, a.name);
      const bScore = this.scoreResult(query, pattern, b.name);
      return bScore - aScore || a.name.localeCompare(b.name);
    };
  }

  static register(provider: StitchWorkspace) {
    return vscode.languages.registerWorkspaceSymbolProvider(
      new StitchWorkspaceSymbolProvider(provider),
    );
  }
}
