import { Yy, YyResourceType } from '@bscotch/yy';
import vscode from 'vscode';
import { GameMakerProject } from './language.project.js';
import { GmlSpec } from './spec.js';

export class GmlProvider
  implements
    vscode.HoverProvider,
    vscode.CompletionItemProvider,
    vscode.SignatureHelpProvider,
    vscode.DocumentFormattingEditProvider,
    vscode.DefinitionProvider,
    vscode.ReferenceProvider
{
  globalCompletions: vscode.CompletionItem[] = [];
  globalHovers: Map<string, vscode.Hover> = new Map();
  globalSignatures: Map<string, vscode.SignatureHelp> = new Map();
  protected projects: GameMakerProject[] = [];

  constructor(readonly spec: GmlSpec) {
    for (const func of spec.functions) {
      this.globalCompletions.push(
        new vscode.CompletionItem(
          func.name,
          vscode.CompletionItemKind.Function,
        ),
      );

      // Create hover-docs
      const docs = new vscode.MarkdownString();
      const signatureString = `${func.name}(${func.parameters
        .map((a) => {
          let param = a.name;
          if (a.optional) {
            param += '?';
          }
          if (a.type) {
            param += `: ${a.type.join('|')}`;
          }
          return param;
        })
        .join(', ')})`;
      docs.appendCodeblock(signatureString, 'gml');
      if (func.description) {
        docs.appendMarkdown(`${func.description}`);
      }
      this.globalHovers.set(func.name, new vscode.Hover(docs));

      // Create signature help
      const help = new vscode.SignatureHelp();
      const signature = new vscode.SignatureInformation(signatureString, docs);
      signature.parameters = func.parameters.map((p) => {
        const param = new vscode.ParameterInformation(p.name, p.description);
        return param;
      });
      help.signatures.push(signature);
      this.globalSignatures.set(func.name, help);
    }
    for (const vars of spec.variables) {
      this.globalCompletions.push(
        new vscode.CompletionItem(
          vars.name,
          vscode.CompletionItemKind.Variable,
        ),
      );
    }
    for (const constant of spec.constants) {
      this.globalCompletions.push(
        new vscode.CompletionItem(
          constant.name,
          vscode.CompletionItemKind.Constant,
        ),
      );
    }
  }

  async loadProject(yypPath: vscode.Uri) {
    const project = await GameMakerProject.from(yypPath);
    this.projects.push(project);
    return project;
  }

  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Location[]> {
    const word = GmlProvider.positionToWord(document, position);
    if (!word) {
      return;
    }
    const project = this.documentToProject(document);
    // Only provide references for globals
    if (!project?.completions.has(word)) {
      return;
    }
    return project.identifiers.get(word);
  }

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
    const word = GmlProvider.positionToWord(document, position);
    if (!word) {
      return;
    }
    const project = this.documentToProject(document);
    if (project?.definitions.has(word)) {
      return project.definitions.get(word);
    }
    return;
  }

  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    if (
      document.languageId !== 'jsonc' ||
      !document.uri.path.match(/\.yyp?$/)
    ) {
      console.warn("Not a yy file, shouldn't format");
      return;
    }
    const parts = document.uri.path.split(/[\\/]+/);
    const name = parts.at(-1)!;
    const type = name.endsWith('.yyp')
      ? 'project'
      : (parts.at(-3) as YyResourceType);
    const text = document.getText();
    const start = document.positionAt(0);
    const end = document.positionAt(text.length);
    const parsed = Yy.parse(text, type);
    const edit = new vscode.TextEdit(
      new vscode.Range(start, end),
      Yy.stringify(parsed, type),
    );
    return [edit];
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    const word = GmlProvider.positionToWord(document, position);
    if (!word) {
      return;
    }
    const project = this.documentToProject(document);
    if (project?.hovers.has(word)) {
      return project.hovers.get(word);
    }
    return this.globalHovers.get(word);
  }

  public async provideCompletionItems(
    document: vscode.TextDocument,
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
    const project = this.documentToProject(document);
    return [
      ...(project?.completions.values() || []),
      ...this.globalCompletions,
    ];
  }

  public provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.SignatureHelp> {
    let leftParensNeeded = 1;
    let offset = document.offsetAt(position);
    let param = 0;
    while (leftParensNeeded > 0 && offset > 0) {
      if (!leftParensNeeded) {
        break;
      }
      offset--;
      const pos = document.positionAt(offset);
      const char = document.getText(new vscode.Range(pos, pos.translate(0, 1)));
      if (char === '(') {
        leftParensNeeded--;
      } else if (char === ')') {
        leftParensNeeded++;
      } else if (char === ',' && leftParensNeeded === 1) {
        param++;
      }
    }
    const func = GmlProvider.positionToWord(
      document,
      document.positionAt(offset),
    );
    const help = this.globalSignatures.get(func);
    if (!help) {
      return;
    }
    help.activeSignature = 0;
    help.activeParameter = param;
    return help;
  }

  /**
   * Determine the project the file belongs to,
   * and pass an update request to that project.
   */
  public updateFile(document: vscode.TextDocument) {
    const project = this.documentToProject(document);
    if (project) {
      project.updateFile(document);
    } else {
      console.error(`Could not find project for ${document.uri}`);
    }
  }

  public documentToProject(
    document: vscode.TextDocument | vscode.Uri,
  ): GameMakerProject | undefined {
    const uri = document instanceof vscode.Uri ? document : document.uri;
    return this.projects.find((p) => p.includesFile(uri));
  }

  static positionToWord(
    document: vscode.TextDocument,
    position: vscode.Position,
  ) {
    const range = document.getWordRangeAtPosition(
      position,
      /(#macro|[a-zA-Z0-9_]+)/,
    );
    return document.getText(range);
  }
}
