import type { GameMakerResource } from '@bscotch/gml-parser';
import vscode from 'vscode';
import type { GameMakerProject } from './extension.project.mjs';
import { locationOf } from './lib.mjs';

export class GameMakerWorkspaceSymbolProvider
  implements vscode.WorkspaceSymbolProvider
{
  resourceCache: Map<
    GameMakerProject,
    Map<GameMakerResource, vscode.SymbolInformation[]>
  > = new Map();
  globalsCache: Map<GameMakerProject, vscode.SymbolInformation[]> = new Map();

  constructor(readonly projects: GameMakerProject[]) {
    this.updateCache();
  }

  updateCache() {
    for (const project of this.projects) {
      this.updateProjectCache(project);
    }
  }

  updateProjectCache(project: GameMakerProject) {
    this.resourceCache.set(project, new Map());
    for (const [, resource] of project.resources) {
      this.updateResourceCache(project, resource);
    }
    this.updateGlobalsCache(project);
  }

  updateResourceCache(project: GameMakerProject, resource: GameMakerResource) {
    const symbols: vscode.SymbolInformation[] = [];
    this.resourceCache.get(project)!.set(resource, symbols);
    // Then add the resource itself. Scripts and objects should point to their GML, while everything else should point to yy files.
    const start = new vscode.Position(0, 0);
    if (resource.type === 'scripts') {
      symbols.push(
        new vscode.SymbolInformation(
          resource.name,
          vscode.SymbolKind.Module,
          resource.type,
          new vscode.Location(
            vscode.Uri.file(resource.gmlFile!.path.absolute),
            start,
          ),
        ),
      );
    } else if (resource.type === 'objects') {
      for (const file of resource.gmlFiles.values()) {
        const symbol = new vscode.SymbolInformation(
          resource.name,
          vscode.SymbolKind.Class,
          `${resource.type} (${file.path.name})`,
          new vscode.Location(vscode.Uri.file(file.path.absolute), start),
        );
        symbols.push(symbol);
      }
    } else {
      symbols.push(
        new vscode.SymbolInformation(
          resource.name,
          vscode.SymbolKind.File,
          resource.type,
          new vscode.Location(vscode.Uri.file(resource.yyPath.absolute), start),
        ),
      );
    }
  }

  updateGlobalsCache(project: GameMakerProject) {
    const symbols: vscode.SymbolInformation[] = [];
    this.globalsCache.set(project, symbols);
    for (const symbol of project.self.symbols.values()) {
      if (['instance', 'asset'].includes(symbol.kind)) {
        continue;
      }
      const kind =
        symbol.kind === 'enum'
          ? vscode.SymbolKind.Enum
          : symbol.kind === 'globalFunction'
          ? vscode.SymbolKind.Function
          : symbol.kind === 'globalVariable'
          ? vscode.SymbolKind.Variable
          : vscode.SymbolKind.Constant;
      symbols.push(
        new vscode.SymbolInformation(
          symbol.name!,
          kind,
          symbol.kind,
          locationOf(symbol as any)!,
        ),
      );
    }
  }

  provideWorkspaceSymbols(query: string): vscode.SymbolInformation[] {
    try {
      const filteredSymbols: vscode.SymbolInformation[] = [];
      query = query.trim();
      const pattern = new RegExp(query.split('').join('.*'));
      const isMatch = (item: { name: string }) =>
        this.scoreResult(query, pattern, item.name) > 0;
      for (const project of this.projects) {
        const resourceCache = this.resourceCache.get(project)!;
        for (const [resource, symbols] of resourceCache.entries()) {
          if (isMatch(resource)) {
            for (const symbol of symbols) {
              filteredSymbols.push(symbol);
            }
          }
        }
        const globalsCache = this.globalsCache.get(project)!;
        for (const symbol of globalsCache) {
          if (isMatch(symbol)) {
            filteredSymbols.push(symbol);
          }
        }
      }
      // Sort by match quality and then only return the top results.
      filteredSymbols.sort(this.resultSorter(query, pattern));
      console.log(
        `Found ${filteredSymbols.length} symbols matching "${query}"`,
      );
      const results = filteredSymbols.slice(0, 20);
      return results;
    } catch (error) {
      console.error(error);
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
      new RegExp(pattern.source),
    ];
    for (const pattern of patterns) {
      const match = result.match(pattern);
      if (!match) {
        break;
      }
      const characterProximityScore = query.length / match[0].length;
      const matchLengthScore = query.length / result.length;
      const positionScore = 1 - match.index! / result.length;
      score += characterProximityScore + positionScore + matchLengthScore;
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
}
