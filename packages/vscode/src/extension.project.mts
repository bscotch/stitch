import { pathy } from '@bscotch/pathy';
import {
  GameMakerIde,
  GameMakerLauncher,
  GameMakerRuntime,
  stringifyGameMakerBuildCommand,
} from '@bscotch/stitch-launcher';
import { Yy, Yyp, YypResource } from '@bscotch/yy';
import path from 'path';
import vscode from 'vscode';
import { StitchConfig } from './extension.config.mjs';
import { GmlFile } from './extension.gml.mjs';
import { GameMakerResource } from './extension.resource.mjs';

export class GameMakerProject extends vscode.TreeItem {
  readonly kind = 'project';
  static config = new StitchConfig();

  /**
   * Globally available completions specific to this project,
   * such as resource names, macros, and script functions. */
  completions: Map<string, vscode.CompletionItem> = new Map();
  hovers: Map<string, vscode.Hover> = new Map();
  signatures: Map<string, vscode.SignatureHelp> = new Map();
  definitions: Map<string, vscode.Location> = new Map();
  identifiers: Map<string, vscode.Location[]> = new Map();

  /** The key is the resource path, e.g. `scripts/my_script` */
  resources: Map<string, GameMakerResource> = new Map();
  /** The key is just the name */
  resourceNames: Map<string, GameMakerResource> = new Map();
  yypWatcher: vscode.FileSystemWatcher;
  gmlWatcher: vscode.FileSystemWatcher;
  yyp!: Yyp;

  protected constructor(readonly yypPath: vscode.Uri) {
    super(yypPath.fsPath, vscode.TreeItemCollapsibleState.Collapsed);
    this.yypWatcher = vscode.workspace.createFileSystemWatcher(
      this.yypPath.fsPath,
    );
    this.gmlWatcher = vscode.workspace.createFileSystemWatcher(
      path.join(this.rootPath, '**', '*.gml'),
    );
    this.yypWatcher.onDidChange(() => this.loadYyp());
    this.gmlWatcher.onDidChange((uri) => this.updateFile(uri));

    // TREE STUFF
    this.iconPath = new vscode.ThemeIcon('file-directory');
  }

  get name() {
    return this.yyp.name;
  }

  get ideVersion() {
    return this.yyp.MetaData.IDEVersion;
  }
  protected gmlFiles: Map<string, GmlFile> = new Map();

  /**
   * Generate a GML-parseable string showing how all global
   * functions map to their scripts, in the format:
   * `func1:script1,func2:script2,func3:script3`
   */
  createFunctionScriptString() {
    const asString = [...this.resources]
      .reduce((acc, [, resource]) => {
        if (resource.type !== 'scripts') {
          return acc;
        }
        resource.gmlFiles.forEach((gmlFile) => {
          gmlFile.globalFunctions.forEach((func) => {
            if (!func.name) {
              return;
            }
            acc.push(`${func.name}:${resource.name}`);
          });
        });

        return acc;
      }, [] as string[])
      .join(',');
    return asString;
  }

  async openInIde() {
    vscode.window.showInformationMessage(
      `Opening project with GameMaker v${this.ideVersion}...`,
    );
    const ide = await GameMakerIde.findInstalled(this.ideVersion);
    if (!ide) {
      vscode.window.showWarningMessage(
        `GameMaker v${this.ideVersion} not found. Attempting to install (this may take a while)...`,
      );
      await GameMakerIde.install(this.ideVersion).catch((err) => {
        vscode.window.showErrorMessage(
          `Failed to install GameMaker v${this.ideVersion}: ${err}`,
        );
      });
    }
    const runner = GameMakerLauncher.openProject(this.yypPath.fsPath, {
      ideVersion: this.yyp.MetaData.IDEVersion,
    });
    runner.catch((err) => {
      vscode.window.showErrorMessage(`Failed to open project: ${err}`);
    });
    return runner;
  }

  async run(options?: { config?: string | null; compiler?: 'yyc' | 'vm' }) {
    const config = options?.config ?? GameMakerProject.config.runConfigDefault;
    const compiler =
      options?.compiler ?? GameMakerProject.config.runCompilerDefault;

    const release = await GameMakerRuntime.findRelease({
      ideVersion: this.ideVersion,
    });
    if (!release) {
      vscode.window.showErrorMessage(
        `Could not find a release of GameMaker v${this.ideVersion} to run this project.`,
      );
      return;
    }
    const runtime = await GameMakerLauncher.findInstalledRuntime({
      version: release.runtime.version,
    });
    if (!runtime) {
      vscode.window.showErrorMessage(
        `Could not find locally installed GameMaker Runtime v${this.ideVersion}. Please install it through the GameMaker IDE and try again.`,
      );
      return;
    }
    const cmd = await stringifyGameMakerBuildCommand(runtime, {
      project: this.yypPath.fsPath,
      config: config || undefined,
      yyc: compiler === 'yyc',
      noCache: false,
      quiet: true,
    });

    // Create or re-use a terminal
    const name = `GameMaker v${release.runtime.version}`;
    const existing = vscode.window.terminals.find((term) => term.name === name);
    if (existing) {
      existing.dispose();
    }

    const terminal = vscode.window.createTerminal({
      name: `GameMaker v${release.runtime.version}`,
    });
    terminal.sendText(cmd);
    terminal.show();
    return;
  }

  get rootPath(): string {
    return path.dirname(this.yypPath.fsPath);
  }

  includesFile(file: vscode.Uri): boolean {
    const relative = path.relative(this.rootPath, file.fsPath);
    return !relative || !relative.startsWith('..');
  }

  /**
   * Determine which resource this file belongs to,
   * and pass an update request to that resource.
   */
  async updateFile(doc: vscode.Uri | vscode.TextDocument): Promise<void> {
    const uri = doc instanceof vscode.Uri ? doc : doc.uri;
    const resourceId = this.filepathToResourceId(uri);
    const resource = this.resources.get(resourceId);
    if (!resource) {
      console.error(`Could not find resource for file ${uri}`);
    } else {
      await resource.loadFile(doc);
    }
  }

  async registerResource(
    info: YypResource,
  ): Promise<GameMakerResource | undefined> {
    const resourceId = this.filepathToResourceId(info.id.path);
    if (this.resources.has(resourceId)) {
      return this.resources.get(resourceId)!;
    }
    const resource = await GameMakerResource.from(this, info);
    if (!resource) {
      console.warn(`Could not find resource files for ${resourceId}`);
      return;
    }
    this.resources.set(resourceId, resource);
    this.resourceNames.set(resource.name, resource);
    this.completions.set(resourceId, resource.completion);
    this.hovers.set(resource.name, await resource.createHover());
    return resource;
  }

  filepathToResource(doc: vscode.TextDocument | vscode.Uri | string) {
    const resourceId = this.filepathToResourceId(doc);
    return this.resources.get(resourceId);
  }

  /**
   * Given a document, return the expected path identifier that
   * the resource it belongs to would have.
   */
  filepathToResourceId(doc: vscode.TextDocument | vscode.Uri | string): string {
    const uri =
      typeof doc === 'string'
        ? doc
        : doc instanceof vscode.Uri
        ? doc.fsPath
        : doc.uri.fsPath;
    const normalized = pathy(this.rootPath).relativeTo(
      path.resolve(this.rootPath, uri),
    );
    const resourceId = normalized.split('/').slice(0, 2).join('/');
    return resourceId;
  }

  async loadYyp() {
    this.yyp = await Yy.read(this.yypPath.fsPath, 'project');
    const waits: Promise<any>[] = [];

    for (const resource of this.yyp.resources) {
      waits.push(this.registerResource(resource));
    }
    await Promise.all(waits);
  }

  static async from(yypPath: vscode.Uri) {
    const project = new GameMakerProject(yypPath);
    await project.loadYyp();
    return project;
  }
}
