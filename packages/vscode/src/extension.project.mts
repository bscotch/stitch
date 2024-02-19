import {
  OnDiagnostics,
  Project,
  ProjectOptions,
  setLogger,
} from '@bscotch/gml-parser';
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
import { stitchConfig } from './config.mjs';
import { stitchEvents } from './events.mjs';
import { killProjectRunner } from './lib.mjs';
import { logger, showErrorMessage, warn } from './log.mjs';

setLogger(logger.withPrefix('PARSER'));

export class GameMakerProject extends Project {
  readonly kind = 'project';

  protected constructor(yypPath: vscode.Uri, options: ProjectOptions) {
    super(pathy(yypPath.fsPath), options);
  }

  get name() {
    return this.yyp.name;
  }

  openInIde() {
    stitchEvents.emit('open-project-start', this);
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
    if (stitchConfig.killOthersOnRun && !options?.clean) {
      const windowTitle = await this.getWindowsName();
      if (windowTitle) {
        logger.info(`Attempting to kill running "${windowTitle} instances...`);
        await killProjectRunner(windowTitle);
        logger.info('Finished killing running instances!');
      }
    }

    stitchEvents.emit(
      options?.clean ? 'clean-project-start' : 'run-project-start',
      this,
    );
    const config = options?.config ?? stitchConfig.runConfigDefault;
    const compiler = options?.compiler ?? stitchConfig.runCompilerDefault;

    logger.info(`Looking for GameMaker v${this.ideVersion}...`);
    const release = await GameMakerRuntime.findRelease({
      ideVersion: this.ideVersion,
    });
    if (!release) {
      showErrorMessage(
        `Could not find a release of GameMaker v${this.ideVersion} to run this project.`,
      );
      return;
    }
    logger.info(`Looking for runtime ${release.runtime.version}...`);
    const runtime = await GameMakerLauncher.findInstalledRuntime({
      version: release.runtime.version,
    });

    logger.info(`Found runtime? ${!!runtime}`);
    if (!runtime) {
      const installOptions = ['Yes', 'No'] as const;
      const chosenOption = await showErrorMessage(
        `The runtime for GameMaker v${this.ideVersion} is either not installed or not discoverable by Stitch. Do you want Stitch to install and launch GameMaker v${this.ideVersion} for you?`,
        ...installOptions,
      );
      if (chosenOption === 'Yes') {
        await this.openInIde();
        vscode.window.showInformationMessage(
          `GameMaker v${this.ideVersion} has been installed and opened. Once it's done installing its runtime you should be able to run your game from Stitch!`,
        );
      }
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
    const options: ProjectOptions = {
      watch: true,
      onDiagnostics,
      onLoadProgress: onProgress,
      settings: {
        autoDeclareGlobalsPrefixes: stitchConfig.autoDeclaredGlobalsPrefixes,
      },
    };
    const project = new GameMakerProject(yypPath, options);
    await project.initialize(options);
    return project;
  }
}
