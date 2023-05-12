import { GameMakerProjectParser } from '@bscotch/gml-parser';
import { pathy } from '@bscotch/pathy';
import {
  GameMakerIde,
  GameMakerLauncher,
  GameMakerRuntime,
  stringifyGameMakerBuildCommand,
} from '@bscotch/stitch-launcher';
import path from 'path';
import vscode from 'vscode';
import { StitchConfig } from './extension.config.mjs';

export class GameMakerProject extends GameMakerProjectParser {
  readonly kind = 'project';
  static config = new StitchConfig();

  protected constructor(yypPath: vscode.Uri) {
    super(pathy(yypPath.fsPath));
  }

  get name() {
    return this.yyp.name;
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
    const runner = GameMakerLauncher.openProject(this.yypPath.absolute, {
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
      project: this.yypPath.absolute,
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

  includesFile(document: vscode.Uri | vscode.TextDocument): boolean {
    const file = document instanceof vscode.Uri ? document : document.uri;
    const relative = path.relative(this.projectDir.absolute, file.fsPath);
    return !relative || !relative.startsWith('..');
  }

  /**
   * Determine which resource this file belongs to,
   * and pass an update request to that resource.
   */
  async updateFile(doc: vscode.Uri | vscode.TextDocument): Promise<void> {
    const uri = pathy((doc instanceof vscode.Uri ? doc : doc.uri).fsPath);
    const resource = this.getResource(uri);
    if (!resource) {
      console.error(`Could not find resource for file ${uri}`);
    } else {
      await resource.reloadFile(uri);
    }
  }

  static async from(yypPath: vscode.Uri) {
    const project = new GameMakerProject(yypPath);
    await project.initialize();
    return project;
  }
}
