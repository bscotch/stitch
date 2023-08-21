import { OnDiagnostics, Project, setLogger } from '@bscotch/gml-parser';
import { pathy } from '@bscotch/pathy';
import {
  GameMakerIde,
  GameMakerLauncher,
  GameMakerRuntime,
  stringifyGameMakerBuildCommand,
  stringifyGameMakerCleanCommand,
} from '@bscotch/stitch-launcher';
import path from 'path';
import vscode from 'vscode';
import { StitchConfig } from './extension.config.mjs';
import { logger, warn } from './log.mjs';

setLogger(logger.withPrefix('PARSER'));

export class GameMakerProject extends Project {
  readonly kind = 'project';
  static config = new StitchConfig();

  protected constructor(yypPath: vscode.Uri) {
    super(pathy(yypPath.fsPath));
  }

  get name() {
    return this.yyp.name;
  }

  openInIde() {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Opening in GameMaker`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({
          increment: 0,
          message: `Searching IDE installs...`,
        });
        const ide = await GameMakerIde.findInstalled(this.ideVersion);
        if (!ide) {
          progress.report({
            increment: 10,
            message: 'Version not found. Installing...',
          });
          await GameMakerIde.install(this.ideVersion);
        }
        progress.report({
          increment: 90,
          message: `Opening project...`,
        });
        const runner = await GameMakerLauncher.openProject(
          this.yypPath.absolute,
          {
            ideVersion: this.yyp.MetaData.IDEVersion,
          },
        );
        progress.report({
          increment: 100,
          message: `Project opened!`,
        });
        return runner;
      },
    );
  }

  async run(options?: {
    config?: string | null;
    compiler?: 'yyc' | 'vm';
    clean?: boolean;
  }) {
    const config = options?.config ?? GameMakerProject.config.runConfigDefault;
    const compiler =
      options?.compiler ?? GameMakerProject.config.runCompilerDefault;

    const release = await GameMakerRuntime.findRelease({
      ideVersion: this.ideVersion,
    });
    if (!release) {
      showErrorMessage(
        `Could not find a release of GameMaker v${this.ideVersion} to run this project.`,
      );
      return;
    }
    const runtime = await GameMakerLauncher.findInstalledRuntime({
      version: release.runtime.version,
    });
    if (!runtime) {
      showErrorMessage(
        `Could not find locally installed GameMaker Runtime v${this.ideVersion}. Please install it through the GameMaker IDE and try again.`,
      );
      return;
    }
    const cmd = await (options?.clean
      ? stringifyGameMakerCleanCommand
      : stringifyGameMakerBuildCommand)(runtime, {
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
    const relative = path.relative(this.dir.absolute, file.fsPath);
    return !relative || !relative.startsWith('..');
  }

  /**
   * Determine which resource this file belongs to,
   * and pass an update request to that resource.
   */
  async updateFile(doc: vscode.Uri | vscode.TextDocument): Promise<void> {
    const uri = pathy((doc instanceof vscode.Uri ? doc : doc.uri).fsPath);
    const resource = this.getAsset(uri);
    if (!resource) {
      warn(`Could not find resource for file ${uri}`);
    } else {
      await resource.reloadFile(uri);
    }
  }

  static async from(
    yypPath: vscode.Uri,
    onDiagnostics: OnDiagnostics,
    onProgress: (increment: number, message?: string) => void,
  ) {
    const project = new GameMakerProject(yypPath);
    await project.initialize({
      watch: true,
      onDiagnostics,
      onLoadProgress: onProgress,
    });
    return project;
  }
}
