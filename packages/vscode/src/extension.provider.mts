import { pathy } from '@bscotch/pathy';
import { StitchProject } from '@bscotch/stitch';
import { sortKeysByReference } from '@bscotch/utility/browser';
import { Yy, YyResourceType } from '@bscotch/yy';
import glob from 'glob';
import os from 'os';
import vscode from 'vscode';
import { debounce } from './debounce.mjs';
import { GameMakerProject } from './extension.project.mjs';
import { GmlSpec, parseSpec } from './spec.mjs';

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

  protected constructor(readonly spec: GmlSpec) {
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

  clearProjects() {
    this.projects = [];
    void vscode.commands.executeCommand(
      'setContext',
      'stitch.projectCount',
      this.projects.length,
    );
  }

  async loadProject(yypPath: vscode.Uri) {
    const project = await GameMakerProject.from(yypPath);
    this.projects.push(project);
    void vscode.commands.executeCommand(
      'setContext',
      'stitch.projectCount',
      this.projects.length,
    );
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

  static get config() {
    const config = vscode.workspace.getConfiguration('stitch');
    return {
      gmlSpecPath: config.get<string | null>('gmlSpec.path'),
      gmlSpecSource: config.get<string | null>('gmlSpec.source'),
      templatePath:
        config.get<string | null>('template.path') ||
        pathy(__dirname).join(
          '..',
          'assets',
          'templates',
          'issue-template',
          'issue-template.yyp',
        ).absolute,
      enableYyFormatting: config.get<boolean>('yy.format.enable'),
    };
  }

  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    if (
      document.languageId !== 'yy' ||
      !GmlProvider.config.enableYyFormatting
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
    const parsed = sortKeysByReference(Yy.parse(text, type), Yy.parse(text));
    const edit = new vscode.TextEdit(
      new vscode.Range(start, end),
      Yy.stringify(parsed),
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

  public provideCompletionItems(
    document: vscode.TextDocument,
  ): vscode.CompletionItem[] | vscode.CompletionList {
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
  public async updateFile(document: vscode.TextDocument) {
    const project = this.documentToProject(document);
    if (project) {
      await project.updateFile(document);
    } else {
      console.error(`Could not find project for ${document.uri}`);
    }
  }

  public documentToProject(
    document: vscode.TextDocument | vscode.Uri,
  ): GameMakerProject | undefined {
    if (!document) {
      return;
    }
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

  /**
   * Only allow a single instance at a time.
   */
  protected static provider: GmlProvider;
  protected static ctx: vscode.ExtensionContext;

  static async activate(ctx: vscode.ExtensionContext) {
    this.ctx ||= ctx;
    if (!this.provider) {
      let gmlSpecFilePath;
      const gmlSpecSource = this.config.gmlSpecSource;
      const gmlSpecFilePathFromSettings = this.config.gmlSpecPath;
      if (gmlSpecSource === 'external' && gmlSpecFilePathFromSettings) {
        gmlSpecFilePath = gmlSpecFilePathFromSettings;
      } else if (gmlSpecSource === 'localRuntime') {
        let runtimeLocalPath;
        if (os.type() == 'Windows_NT') {
          runtimeLocalPath = 'C:/ProgramData/GameMakerStudio2/Cache/runtimes/';
        } else if (os.type() == 'Darwin') {
          runtimeLocalPath = '/Users/Shared/GameMakerStudio2/Cache/runtimes/'; // (LiarOnce) Need testing because I don't have any macOS devices.
        } else if (os.type() == 'Linux') {
          runtimeLocalPath = '~/.local/GameMakerStudio2-Beta/Cache/runtimes/'; // GameMaker IDE in Linux only available in Beta channel
        }
        const runtimeGlob = await glob(runtimeLocalPath + '**/GmlSpec.xml', {});
        gmlSpecFilePath = runtimeGlob[0]; // Always get the latest version of the installed runtimes' GmlSpec.xml files on local
      }
      this.provider = new GmlProvider(
        await parseSpec(gmlSpecFilePath as string),
      );
      const onChangeDoc = debounce((event: vscode.TextDocumentChangeEvent) => {
        const doc = event.document;
        if (doc.languageId !== 'gml') {
          return;
        }
        void GmlProvider.provider.updateFile(event.document);
      }, 100);

      vscode.workspace.onDidChangeTextDocument(onChangeDoc);
    }

    // Dispose any existing subscriptions
    // to allow for reloading the extension
    this.ctx.subscriptions.forEach((s) => s.dispose());

    ctx.subscriptions.push(
      vscode.languages.registerHoverProvider('gml', this.provider),
      vscode.languages.registerCompletionItemProvider(
        'gml',
        this.provider,
        '.',
        '"',
      ),
      vscode.languages.registerSignatureHelpProvider(
        'gml',
        this.provider,
        '(',
        ',',
      ),
      vscode.languages.registerDocumentFormattingEditProvider(
        'yy',
        this.provider,
      ),
      vscode.languages.registerDefinitionProvider('gml', this.provider),
      vscode.languages.registerReferenceProvider('gml', this.provider),
      vscode.commands.registerCommand('stitch.openIde', (...args) => {
        const uri = vscode.Uri.parse(
          args[0] || vscode.window.activeTextEditor?.document.uri.toString(),
        );
        this.provider.documentToProject(uri)?.openInIde();
      }),
      vscode.commands.registerCommand(
        'stitch.createProject',
        async (folder: vscode.Uri, ...args: any[]) => {
          // stitch.template.path
          if (!(folder instanceof vscode.Uri)) {
            console.warn('No folder selected');
            return;
          }
          const isInProject = this.provider.documentToProject(folder);
          if (isInProject) {
            void vscode.window.showErrorMessage(
              'Cannot create a project inside another project',
            );
            return;
          }
          const templatePath = this.config.templatePath;
          if (!templatePath || !(await pathy(templatePath).exists())) {
            return void vscode.window.showErrorMessage(
              `Template not found at ${templatePath}`,
            );
          }
          vscode.window.showInformationMessage('Cloning template...');
          const template = await StitchProject.cloneProject({
            templatePath,
            where: folder.fsPath,
          });
          const projectUri = vscode.Uri.file(template.yypPathAbsolute);
          console.log('projectUri', projectUri);
          this.provider.loadProject(projectUri);
        },
      ),
    );

    this.provider.clearProjects();

    const yypFiles = await vscode.workspace.findFiles(`**/*.yyp`);

    for (const yypFile of yypFiles) {
      await GmlProvider.provider.loadProject(yypFile);
    }

    return this.provider;
  }
}
