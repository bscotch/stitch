import { YyResourceType } from '@bscotch/yy';
import { readFile } from 'fs/promises';
import path from 'path';
import { StitchTreeItemBase } from 'tree.base.mjs';
import vscode from 'vscode';
import type { GameMakerResource } from './extension.resource.mjs';
import { getEventName } from './spec.events.mjs';

// TODO: Add command to open the current project in GameMaker;

const SyntaxKind: any = {}; // LEGACY

export class GmlFile extends StitchTreeItemBase {
  readonly kind = 'gmlFile';
  readonly dir: string;
  readonly resourceType: YyResourceType;
  readonly resourceName: string;

  // Track any globals defined in this file
  readonly globals: Set<string> = new Set();
  readonly globalDefinitions: Map<string, vscode.Location> = new Map();
  readonly identifiers: Map<string, vscode.Location[]> = new Map();

  constructor(readonly resource: GameMakerResource, readonly uri: vscode.Uri) {
    super(path.basename(uri.fsPath));
    this.dir = path.dirname(uri.fsPath);
    this.resourceName = path.basename(this.dir);
    this.resourceType = path.basename(path.dirname(this.dir)) as YyResourceType;

    // TREE STUFF
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [uri],
    };
    this.setIcon();

    // Ensure that the tree label is human-friendly.
    this.label = getEventName(this.uri.fsPath);
  }

  protected setIcon() {
    // Set the default
    if (this.name.startsWith('Other_')) {
      this.setObjectEventIcon('other');
    } else {
      this.setGameMakerIcon('script');
    }

    // Override for object events
    if (this.name.match(/^Draw_\d+$/i)) {
      this.setObjectEventIcon('draw');
    } else if (this.name.match(/^Alarm_\d+$/i)) {
      this.setObjectEventIcon('alarm');
    } else if (this.name.match(/^Step_\d+$/i)) {
      this.setObjectEventIcon('step');
    } else if (this.name === 'Create_0') {
      this.setObjectEventIcon('create');
    } else if (this.name === 'Destroy_0') {
      this.setObjectEventIcon('destroy');
    } else if (this.name === 'CleanUp_0') {
      this.setObjectEventIcon('cleanup');
    } else if (this.name.match(/^Other_(7[250]|6[239])$/i)) {
      this.setObjectEventIcon('asynchronous');
    }
  }

  get name() {
    return path.basename(this.uri.fsPath, '.gml');
  }

  get basename() {
    return path.basename(this.uri.fsPath);
  }

  async load(doc?: vscode.TextDocument) {
    const text = doc?.getText() || (await readFile(this.uri.fsPath, 'utf8'));
    const parser: any = undefined;
    // Add all identifiers to project-wide identifiers
    for (const [, nodes] of parser.identifiers) {
      for (const node of nodes) {
        this.addProjectIdentifierReference(node);
      }
    }

    // Add all macros to project-wide completions
    for (const [name, node] of parser.macros) {
      this.addProjectCompletion(node, vscode.CompletionItemKind.Constant);
      this.addProjectDefinition(node);
      this.addProjectHover(name, `#macro ${name} ${node.info ?? ''}`);
      // TODO: Add definition location lookup
    }
    // Add all globalvars to project-wide completions
    for (const [name, node] of parser.globalvars) {
      this.addProjectCompletion(node, vscode.CompletionItemKind.Variable);
      this.addProjectDefinition(node);
      this.addProjectHover(name, `globalvar ${name}`);
      // TODO: Add definition location lookup
    }
    for (const [name, node] of parser.enums) {
      this.addProjectCompletion(node, vscode.CompletionItemKind.Enum);
      this.addProjectDefinition(node);
      this.addProjectHover(name, `enum ${name}`);
      // TODO: Add definition location lookup
      for (const [, value] of node.info) {
        const memberName = `${name}.${value.name}`;
        this.addProjectCompletion(
          node,
          vscode.CompletionItemKind.EnumMember,
          memberName,
        );
      }
    }
    // Add all global functions and enums to project-wide completions
    if (this.resourceType === 'scripts') {
      for (const [name, node] of parser.functions) {
        if (!node.name) {
          continue;
        }

        const paramNames = node.info.map((p: any) => p.name);
        this.addProjectCompletion(
          node,
          node.kind === SyntaxKind.ConstructorDeclaration
            ? vscode.CompletionItemKind.Constructor
            : vscode.CompletionItemKind.Function,
        );
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
          (p: any) => new vscode.ParameterInformation(p),
        );
        help.signatures.push(signature);

        // TODO: Add definition location lookup
      }
    }
  }

  addIdentifierLocation(info: any) {
    if (!info.name) {
      return;
    }
    const range = new vscode.Range(
      new vscode.Position(info.position.line - 1, info.position.column),
      new vscode.Position(
        info.position.line - 1,
        info.position.column + info.name.length,
      ),
    );
    const location = new vscode.Location(this.uri, range);
    // Add to the file identifiers
    this.identifiers.set(info.name, this.identifiers.get(info.name) ?? []);
    this.identifiers.get(info.name)!.push(location);
  }

  addProjectIdentifierReference(info: any) {
    this.addIdentifierLocation(info);
    if (!info.name) {
      return;
    }
    const range = new vscode.Range(
      new vscode.Position(info.position.line - 1, info.position.column),
      new vscode.Position(
        info.position.line - 1,
        info.position.column + info.name.length,
      ),
    );
    const location = new vscode.Location(this.uri, range);
  }

  addProjectDefinition(info: any) {
    if (!info.name) {
      return;
    }
    const location = new vscode.Location(
      this.uri,
      new vscode.Position(info.position.line - 1, info.position.column),
    );
  }

  addProjectCompletion(
    node: any,
    type: vscode.CompletionItemKind,
    name?: string,
  ) {
    name = name ?? node.name ?? undefined;
    if (!name) {
      return;
    }
    this.addIdentifierLocation(node);
    this.globals.add(name);
    // this.resource.project.completions.set(
    //   name,
    //   new vscode.CompletionItem(name, type),
    // );
  }

  addProjectHover(name: string, code: string) {
    // Add hover
    const docs = new vscode.MarkdownString();
    docs.appendCodeblock(code, 'gml');
    // this.resource.project.hovers.set(name, new vscode.Hover(docs));
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
