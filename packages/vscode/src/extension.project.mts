import {
  OnDiagnostics,
  Project,
  ProjectOptions,
  setLogger,
} from '@bscotch/gml-parser';
import { pathy } from '@bscotch/pathy';
import {
  findIde,
  findRuntime,
  getIdeVersionDetails,
  installIde,
  openProject,
  prepareIgorCommand,
  type IgorShell,
  type InstallProgress,
  type RunningIde,
} from '@bscotch/stitch-launcher';
import path from 'path';
import vscode from 'vscode';
import { loudlyLogThrownAsync } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import { stitchEvents } from './events.mjs';
import { showLauncherError } from './extension.launcher.mjs';
import { killProjectRunner } from './lib.mjs';
import { logger, showErrorMessage, warn } from './log.mjs';

setLogger(logger.withPrefix('PARSER'));

/** The kind of shell VS Code's terminals use, for quoting commands */
function terminalShell(): IgorShell {
  const shell = path.basename(vscode.env.shell || '').toLowerCase();
  if (/^(pwsh|powershell)(\.exe)?$/.test(shell)) return 'powershell';
  if (/^cmd(\.exe)?$/.test(shell)) return 'cmd';
  if (shell) return 'posix';
  return process.platform === 'win32' ? 'powershell' : 'posix';
}

function describeInstallProgress(p: InstallProgress): string {
  switch (p.stage) {
    case 'checking':
      return 'Checking prerequisites...';
    case 'downloading':
      return p.totalBytes
        ? `Downloading installer (${Math.round((100 * p.receivedBytes) / p.totalBytes)}%)...`
        : `Downloading installer (${Math.round(p.receivedBytes / 1024 ** 2)} MB)...`;
    case 'verifying':
      return 'Verifying installer...';
    case 'extracting':
      return 'Extracting...';
    case 'done':
      return 'Installed!';
  }
}

export class GameMakerProject extends Project {
  readonly kind = 'project';
  public runnerTerminal?: vscode.Terminal;

  protected constructor(yypPath: vscode.Uri, options: ProjectOptions) {
    super(pathy(yypPath.fsPath), options);
  }

  get name() {
    return this.yyp.name;
  }

  /**
   * Open the project in its GameMaker IDE version, installing that version
   * into Stitch's cache first if needed. Shows errors (with fixes, where
   * possible) instead of throwing.
   */
  async openInIde(): Promise<RunningIde | undefined> {
    stitchEvents.emit('open-project-start', this);
    const options = stitchConfig.launcherOptions;
    const ideVersion = this.ideVersion;
    try {
      return await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Opening in GameMaker v${ideVersion}`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Looking for this GameMaker version...' });
          if (!(await findIde(ideVersion, options))) {
            progress.report({ message: 'Not installed yet. Installing...' });
            await installIde(ideVersion, {
              ...options,
              onProgress: (p) =>
                progress.report({ message: describeInstallProgress(p) }),
            });
          }
          progress.report({ message: 'Opening project...' });
          const running = await openProject(this.yypPath.absolute, {
            ...options,
            ideVersion,
            suppressUpdatePrompt: stitchConfig.disableGameMakerUpdatePrompt,
          });
          progress.report({
            message: 'Opened! The window may take a few seconds to appear.',
          });
          return running;
        },
      );
    } catch (err) {
      await showLauncherError(err);
      return;
    }
  }

  async kill() {
    const windowTitle = await this.getWindowsName();
    if (windowTitle) {
      logger.info(`Attempting to kill running "${windowTitle} instances...`);
      await killProjectRunner(windowTitle);
      logger.info('Finished killing running instances!');
    }
    // Send a signal to the terminal to abort the current command
    this.runnerTerminal?.sendText('\x03');
    // Emit a signal to the webview to stop the current command
    stitchEvents.emit('request-kill-project-in-webview');
  }

  async run(options?: {
    config?: string | null;
    compiler?: 'yyc' | 'vm';
    clean?: boolean;
  }) {
    if (stitchConfig.killOthersOnRun && !options?.clean) {
      await this.kill();
    }

    stitchEvents.emit(
      options?.clean ? 'clean-project-start' : 'run-project-start',
      this,
    );
    const config = options?.config ?? stitchConfig.runConfigDefault;
    let compiler = options?.compiler ?? stitchConfig.runCompilerDefault;
    if (['yyc', 'vm'].indexOf(compiler) === -1) {
      compiler = stitchConfig.runCompilerDefault;
    }

    const launcher = stitchConfig.launcherOptions;
    logger.info(`Looking for the runtime for GameMaker v${this.ideVersion}...`);
    let runtimeVersion: string;
    try {
      runtimeVersion = (
        await getIdeVersionDetails(this.ideVersion, {
          ...launcher,
          runtimeVersion: this.config?.runtimeVersion,
        })
      ).runtimeVersion;
    } catch (err) {
      await showLauncherError(err).catch(() =>
        showErrorMessage(
          `Could not find GameMaker v${this.ideVersion} to run this project.`,
        ),
      );
      return;
    }
    logger.info(`Looking for runtime ${runtimeVersion}...`);
    const runtime = await findRuntime(runtimeVersion, launcher);

    logger.info(`Found runtime? ${!!runtime}`);
    if (!runtime) {
      const installOptions = ['Yes', 'No'] as const;
      const chosenOption = await showErrorMessage(
        `GameMaker runtime ${runtimeVersion} (for GameMaker v${this.ideVersion}) is not installed. GameMaker installs its runtime when it starts. Do you want Stitch to open the project in GameMaker v${this.ideVersion}?`,
        ...installOptions,
      );
      if (chosenOption === 'Yes') {
        const running = await this.openInIde();
        if (running) {
          void vscode.window.showInformationMessage(
            `GameMaker v${this.ideVersion} is starting. Once it has installed its runtime, you can run your game from Stitch!`,
          );
        }
      }
      return;
    }

    logger.info('Computing Igor command...');
    const command = await loudlyLogThrownAsync(
      async () =>
        await prepareIgorCommand(
          {
            project: this.yypPath.absolute,
            runtime,
            command: options?.clean ? 'Clean' : 'Run',
            config: config || undefined,
            compiler,
            verbose: false,
          },
          launcher,
        ),
    );

    if (stitchConfig.runInTerminal) {
      const cmd = command.toShellString(terminalShell());
      logger.info(`Igor command:`, cmd);

      // Create or re-use a terminal
      if (
        !this.runnerTerminal ||
        this.runnerTerminal.exitStatus ||
        !stitchConfig.killOthersOnRun // Then we can't safely re-use
      ) {
        this.runnerTerminal?.dispose();
        this.runnerTerminal = vscode.window.createTerminal({
          name: `GameMaker Runner`,
        });
      }
      this.runnerTerminal.sendText(cmd);
      this.runnerTerminal.show();
    } else {
      logger.info('Running command:', command.cmd, command.args);
      stitchEvents.emit('request-run-project-in-webview', {
        command,
        runtime,
        project: this,
        clean: options?.clean,
      });
    }
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
      onDiagnostics,
      onLoadProgress: onProgress,
      settings: {
        autoDeclareGlobalsPrefixes: stitchConfig.autoDeclaredGlobalsPrefixes,
      },
      logger,
      launcher: stitchConfig.launcherOptions,
    };
    const project = new GameMakerProject(yypPath, options);
    await project.initialize(options);
    return project;
  }
}
