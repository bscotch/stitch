import { pathy } from '@bscotch/pathy';
import { StitchProject } from '@bscotch/stitch';
import { sortKeysByReference } from '@bscotch/utility/browser';
import { Yy, YyResourceType } from '@bscotch/yy';
import glob from 'glob';
import os from 'os';
import process from 'process';
import vscode from 'vscode';
import { debounce } from './debounce.mjs';
import { StitchConfig, StitchTaskDefinition } from './extension.config.mjs';
import { GameMakerProject } from './extension.project.mjs';
import { GmlSpec, parseSpec } from './spec.mjs';

const jsdocCompletions = [
  '@param',
  '@returns',
  '@description',
  '@self',
  '@function',
  '@ignore',
  '@pure',
  '@deprecated',
].map(
  (tag) => new vscode.CompletionItem(tag, vscode.CompletionItemKind.Property),
);

export class GmlProvider
  implements
    vscode.HoverProvider,
    vscode.CompletionItemProvider,
    vscode.SignatureHelpProvider,
    vscode.DocumentFormattingEditProvider,
    vscode.DefinitionProvider,
    vscode.ReferenceProvider,
    vscode.WorkspaceSymbolProvider,
    vscode.TaskProvider
{
  globalTypeCompletions: vscode.CompletionItem[] = [];
  globalCompletions: vscode.CompletionItem[] = [];
  globalHovers: Map<string, vscode.Hover> = new Map();
  globalSignatures: Map<string, vscode.SignatureHelp> = new Map();
  protected projects: GameMakerProject[] = [];
  static config = new StitchConfig();

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
      const item = new vscode.CompletionItem(
        vars.name,
        vars.writable
          ? vscode.CompletionItemKind.Variable
          : vscode.CompletionItemKind.Constant,
      );
      item.documentation = vars.description;
      this.globalCompletions.push(item);
    }
    for (const constant of spec.constants) {
      this.globalCompletions.push(
        new vscode.CompletionItem(
          constant.name,
          vscode.CompletionItemKind.Constant,
        ),
      );
    }
    for (const type of spec.types) {
      this.globalTypeCompletions.push(
        new vscode.CompletionItem(type, vscode.CompletionItemKind.Class),
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

  async provideTasks(): Promise<vscode.Task[]> {
    const tasks: vscode.Task[] = [];
    if (!this.projects.length || !GmlProvider.config.autoDetectTasks) {
      return tasks;
    }
    for (const project of this.projects) {
      const taskDefinition: StitchTaskDefinition = {
        type: 'stitch',
        task: 'run',
        compiler: GmlProvider.config.runCompilerDefault,
        config:
          GmlProvider.config.runConfigDefault ||
          project.yyp.configs.children[0]?.name ||
          project.yyp.configs.name,
        projectName: project.name,
      };
      const command = await project.computeRunCommand(taskDefinition);
      if (!command) continue;
      const task = new vscode.Task(
        taskDefinition,
        vscode.TaskScope.Workspace,
        taskDefinition.task,
        `Run ${project.name}`,
        new vscode.ProcessExecution(command.cmd, command.args, {
          cwd: project.rootPath,
        }),
      );
      tasks.push(task);
    }
    return tasks;
  }

  resolveTask(task: vscode.Task): vscode.Task {
    // console.log('RESOLVE', task);
    // const project: GameMakerProject =
    //   (task.definition.projectName &&
    //     this.projects.find((p) => p.name === task.definition.projectName)) ||
    //   this.projects[0];
    // assertLoudly(project, 'Could not resolve project.');
    // const command = await project.computeRunCommand();
    // assertLoudly(command, 'Could not compute run command');
    // task.execution = new vscode.ProcessExecution(command.cmd, command.args);
    // console.log('RESOLVED', task);
    // return task;
    return task;
  }

  provideWorkspaceSymbols(
    query: string,
  ): vscode.ProviderResult<vscode.SymbolInformation[]> {
    const symbols: vscode.SymbolInformation[] = [];
    const matcher = new RegExp(query.split('').join('.*'), 'i');
    for (const project of this.projects) {
      project.definitions.forEach((loc, name) => {
        if (matcher.test(name)) {
          symbols.push(
            new vscode.SymbolInformation(
              name,
              vscode.SymbolKind.Variable,
              loc.range,
              loc.uri,
            ),
          );
        }
      });
    }
    return symbols;
  }

  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
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

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | vscode.CompletionList {
    const project = this.documentToProject(document);
    // If we're in JSDoc comment, and within a `{}` block,
    if (GmlProvider.positionIsInJsdocComment(document, position)) {
      // Are we inside a `{}` block?
      let inBlock = false;
      let offset = document.offsetAt(position);
      while (offset > 0) {
        offset--;
        const pos = document.positionAt(offset);
        const char = document.getText(
          new vscode.Range(pos, pos.translate(0, 1)),
        );
        if (['}', '\r', '\n'].includes(char)) {
          break;
        } else if (char === '{') {
          inBlock = true;
          break;
        }
      }
      if (inBlock) {
        const haveNames = new Set<string>();
        const projectConstructors = [...(project?.completions.values() || [])]
          ?.map((comp) => {
            if (comp.kind === vscode.CompletionItemKind.Constructor) {
              const label = `Struct.${comp.label}`;
              if (haveNames.has(label)) {
                return;
              }
              haveNames.add(label);
              return new vscode.CompletionItem(
                label,
                vscode.CompletionItemKind.Constructor,
              );
            } else if (comp.kind === vscode.CompletionItemKind.Enum) {
              const label = `Enum.${comp.label}`;
              if (haveNames.has(label)) {
                return;
              }
              haveNames.add(label);
              return new vscode.CompletionItem(
                label,
                vscode.CompletionItemKind.Enum,
              );
            } else {
              return;
            }
          })
          .filter((x) => x) as vscode.CompletionItem[];
        return [...projectConstructors, ...this.globalTypeCompletions];
      }
      // Otherwise we can return valid JSDoc tags.
      return jsdocCompletions;
    }

    // Are we dotting into something?
    const dottingInto = GmlProvider.positionToDottingInto(document, position);
    if (!dottingInto) {
      return [
        ...(project?.completions.values() || []),
        ...this.globalCompletions,
      ];
    } else {
      // Autocomplete with fields of what we're dotting into.
      return [];
    }
  }

  provideSignatureHelp(
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
  async updateFile(document: vscode.TextDocument) {
    const project = this.documentToProject(document);
    if (project) {
      await project.updateFile(document);
    } else {
      console.error(`Could not find project for ${document.uri}`);
    }
  }

  documentToProject(
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

  static positionIsInJsdocComment(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): boolean {
    let offset = document.offsetAt(position);
    let commentCharsSoFar = '';
    while (offset > 0) {
      offset--;
      const pos = document.positionAt(offset);
      const char = document.getText(new vscode.Range(pos, pos.translate(0, 1)));
      if (['\r', '\n', ''].includes(char)) {
        return false;
      }
      if (char === '/' && commentCharsSoFar === '//') {
        return true;
      } else if (char === '/') {
        commentCharsSoFar += '/';
      } else {
        // Reset!
        commentCharsSoFar = '';
      }
    }
    return false;
  }

  /**
   * At a given position, determine if we're dotting into
   * something, and if so, what.
   */
  static positionToDottingInto(
    document: vscode.TextDocument,
    position: vscode.Position,
  ) {
    // Are we dotting into something?
    let dottingInto: string | undefined;
    let offset = document.offsetAt(position);
    while (offset > 0) {
      offset--;
      const pos = document.positionAt(offset);
      const char = document.getText(new vscode.Range(pos, pos.translate(0, 1)));
      // Skip over identifier characters until we hit a dot or something else
      if (/[a-zA-Z0-9_]/.test(char)) {
        continue;
      }
      if (char === '.') {
        dottingInto = GmlProvider.positionToWord(
          document,
          document.positionAt(offset - 1),
        );
        break;
      } else {
        break;
      }
    }
    return dottingInto;
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
      const gmChannel = this.config.gmChannel;
      const gmlSpecSource = this.config.gmlSpecSource;
      const gmlSpecFilePathFromSettings = this.config.gmlSpecPath;
      if (gmlSpecSource === 'external' && gmlSpecFilePathFromSettings) {
        gmlSpecFilePath = gmlSpecFilePathFromSettings;
      } else if (gmlSpecSource === 'localRuntime') {
        let runtimeLocalPath;
        if (os.type() == 'Windows_NT') {
          // Get the path of runtime from the system environment variable.
          // And change the backslash to forward slash, otherwise the path cannot be found
          // In most cases, it should be "C:/ProgramData".
          // However, in rare cases, the Windows drive letter installed by the user is not C:
          runtimeLocalPath =
            (process.env.ALLUSERSPROFILE as string).replace('\\', '/') +
            '/' +
            gmChannel +
            '/Cache/runtimes/';
        } else if (os.type() == 'Darwin') {
          // (LiarOnce) Need testing because I don't have any macOS devices.
          runtimeLocalPath = '/Users/Shared/' + gmChannel + '/Cache/runtimes/';
        } else if (os.type() == 'Linux') {
          // GameMaker IDE in Linux only available in Beta channel (GameMakerStudio2-Beta)
          runtimeLocalPath = '~/.local/' + gmChannel + '/Cache/runtimes/';
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
        // '.',
        // '"',
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
      vscode.languages.registerWorkspaceSymbolProvider(this.provider),
      vscode.tasks.registerTaskProvider('stitch', this.provider),
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
