import { ParsedNode, Parser, SyntaxKind } from '@bscotch/gml-parser';
import { YyResourceType } from '@bscotch/yy';
import { readFile } from 'fs/promises';
import path from 'path';
import vscode from 'vscode';
import type { GameMakerResource } from './language.resource.mjs';

// TODO: Add command to open the current project in GameMaker

export class GmlFile {
  readonly dir: string;
  readonly resourceType: YyResourceType;
  readonly resourceName: string;

  // Track any globals defined in this file
  readonly globals: Set<string> = new Set();
  readonly globalDefinitions: Map<string, vscode.Location> = new Map();
  readonly identifiers: Map<string, vscode.Location[]> = new Map();

  constructor(readonly resource: GameMakerResource, readonly uri: vscode.Uri) {
    this.dir = path.dirname(uri.fsPath);
    this.resourceName = path.basename(this.dir);
    this.resourceType = path.basename(path.dirname(this.dir)) as YyResourceType;
  }

  async load(doc?: vscode.TextDocument) {
    this.clearGlobals();
    const text = doc?.getText() || (await readFile(this.uri.fsPath, 'utf8'));
    const parser = new Parser(text);
    try {
      parser.parse();
    } catch (e) {
      console.error(`Error parsing ${this.uri.fsPath}: ${e}`);
    }
    // Add all identifiers to project-wide identifiers
    for (const [, node] of parser.identifiers) {
      this.addProjectIdentifierReference(node);
    }

    // Add all macros to project-wide completions
    for (const [name, node] of parser.macros) {
      this.addProjectCompletion(name, vscode.CompletionItemKind.Constant);
      this.addProjectDefinition(node);
      this.addProjectHover(name, `#macro ${name} ${node.info ?? ''}`);
      // TODO: Add definition location lookup
    }
    // Add all globalvars to project-wide completions
    for (const [name, node] of parser.globalvars) {
      this.addProjectCompletion(name, vscode.CompletionItemKind.Variable);
      this.addProjectDefinition(node);
      this.addProjectHover(name, `globalvar ${name}`);
      // TODO: Add definition location lookup
    }
    // Add all global functions and enums to project-wide completions
    if (this.resourceType === 'scripts') {
      for (const [name, node] of parser.enums) {
        this.addProjectCompletion(name, vscode.CompletionItemKind.Enum);
        this.addProjectDefinition(node);
        this.addProjectHover(name, `enum ${name}`);
        // TODO: Add definition location lookup
        // TODO: Add enum members to project-wide completions
      }
      for (const [name, node] of parser.functions) {
        if (!node.name) {
          continue;
        }
        const paramNames = node.info.map((p) => p.name);
        this.addProjectCompletion(name, vscode.CompletionItemKind.Function);
        this.addProjectDefinition(node);
        const signatureString = `${
          node.kind === SyntaxKind.ConstructorDeclaration
            ? 'constructor'
            : 'function'
        } ${node.name}(${paramNames.join(', ')})`;
        this.addProjectHover(node.name, signatureString);

        // Create signature help
        const help = new vscode.SignatureHelp();
        const signature = new vscode.SignatureInformation(signatureString);
        signature.parameters = paramNames.map(
          (p) => new vscode.ParameterInformation(p),
        );
        help.signatures.push(signature);
        this.resource.project.signatures.set(node.name, help);

        // TODO: Add definition location lookup
      }
    }
  }

  protected clearGlobals() {
    for (const name of this.globals) {
      this.resource.project.completions.delete(name);
      this.resource.project.hovers.delete(name);
      this.resource.project.signatures.delete(name);
      this.resource.project.definitions.delete(name);
    }
    this.globals.clear();
    this.globalDefinitions.clear();
    // Clear all identifier references
    for (const [name] of this.identifiers) {
      const refs = this.resource.project.identifiers.get(name) ?? [];
      for (let i = refs.length - 1; i >= 0; i--) {
        if (refs[i].uri.toString() === this.uri.toString()) {
          refs.splice(i, 1);
        }
      }
    }
  }

  addProjectIdentifierReference(info: ParsedNode) {
    if (!info.name) {
      return;
    }
    const location = new vscode.Location(
      this.uri,
      new vscode.Position(info.position.line - 1, info.position.column),
    );
    const ids = this.resource.project.identifiers;
    ids.set(info.name, ids.get(info.name) ?? []);
    ids.get(info.name)!.push(location);
  }

  addProjectDefinition(info: ParsedNode) {
    if (!info.name) {
      return;
    }
    const location = new vscode.Location(
      this.uri,
      new vscode.Position(info.position.line - 1, info.position.column),
    );
    this.resource.project.definitions.set(info.name, location);
  }

  addProjectCompletion(name: string, type: vscode.CompletionItemKind) {
    this.globals.add(name);
    this.resource.project.completions.set(
      name,
      new vscode.CompletionItem(name, type),
    );
  }

  addProjectHover(name: string, code: string) {
    // Add hover
    const docs = new vscode.MarkdownString();
    docs.appendCodeblock(code, 'gml');
    this.resource.project.hovers.set(name, new vscode.Hover(docs));
  }

  toJSON() {
    return {
      resourceType: this.resourceType,
      resourceName: this.resourceName,
      path: this.uri.fsPath,
      dir: this.dir,
    };
  }
}
