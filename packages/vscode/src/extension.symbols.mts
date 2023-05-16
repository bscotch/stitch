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
      console.log('Updated cache for', project.name);
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
        symbols.push(
          new vscode.SymbolInformation(
            resource.name,
            vscode.SymbolKind.Namespace,
            `${resource.type} (${file.path.name})`,
            new vscode.Location(vscode.Uri.file(file.path.absolute), start),
          ),
        );
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
          'global',
          locationOf(symbol as any)!,
        ),
      );
    }
  }

  provideWorkspaceSymbols(query: string): vscode.SymbolInformation[] {
    const filteredSymbols: vscode.SymbolInformation[] = [];
    query = query.trim();
    console.log('Searching for', query);
    for (const project of this.projects) {
      const resourceCache = this.resourceCache.get(project)!;
      for (const [resource, symbols] of resourceCache.entries()) {
        console.log('Searching', resource.name);
        if (resource.name.includes(query)) {
          for (const symbol of symbols) {
            filteredSymbols.push(symbol);
          }
        }
      }
      const globalsCache = this.globalsCache.get(project)!;
      for (const symbol of globalsCache) {
        if (symbol.name.includes(query)) {
          filteredSymbols.push(symbol);
        }
      }
    }
    return filteredSymbols;
  }
}
