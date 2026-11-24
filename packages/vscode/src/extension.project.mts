import { GameMakerProject, type Asset } from '@bscotch/gamemaker-project';
import { pathy, type Pathy } from '@bscotch/pathy';
import {
  findIde,
  findRuntime,
  getIdeVersionDetails,
  installIde,
  listAvailableIdes,
  openProject,
  prepareIgorCommand,
  type IgorShell,
  type InstallProgress,
  type RunningIde,
} from '@bscotch/stitch-launcher';
import fs from 'node:fs/promises';
import path from 'node:path';
import vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import { loudlyLogThrownAsync } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import { stitchEvents } from './events.mjs';
import { showLauncherError } from './extension.launcher.mjs';
import { killProjectRunner } from './lib.mjs';
import { logger, showErrorMessage } from './log.mjs';

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

/**
 * A loaded GameMaker project: the project's files (via
 * `@bscotch/gamemaker-project`, the only thing in the extension that changes
 * them), the language server analyzing its code, and running it.
 */
export class StitchProject {
  readonly kind = 'project';
  public runnerTerminal?: vscode.Terminal;
  /** The language server for this project, once started */
  public client?: LanguageClient;
  protected helpLinksFile?: Promise<Record<string, string>>;

  constructor(readonly gm: GameMakerProject) {}

  static async open(yypPath: string): Promise<StitchProject> {
    return new StitchProject(await GameMakerProject.open(yypPath));
  }

  get name(): string {
    return this.gm.name;
  }

  get yyp() {
    return this.gm.yyp;
  }

  get dir(): Pathy {
    return pathy(this.gm.dir);
  }

  get yypPath(): Pathy {
    return pathy(this.gm.yypPath);
  }

  get ideVersion(): string {
    return this.gm.ideVersion;
  }

  get config() {
    return this.gm.config;
  }

  get configs(): string[] {
    return this.gm.configs;
  }

  /** Make sure the Stitch config is up to date with what's on disk */
  async reloadConfig() {
    await this.gm.reconcile([path.join(this.gm.dir, 'stitch.config.json')]);
    return this.gm.config;
  }

  getAssetByName(name: string | undefined): Asset | undefined {
    return name ? this.gm.getAsset(name) : undefined;
  }

  /** The asset a file belongs to */
  getAssetByPath(file: string | vscode.Uri): Asset | undefined {
    return this.gm.getAssetByPath(
      typeof file === 'string' ? file : file.fsPath,
    );
  }

  async setIdeVersion(version: string) {
    await this.gm.setIdeVersion(version);
  }

  async getWindowsName() {
    return await this.gm.getWindowsName();
  }

  includesFile(document: vscode.Uri | vscode.TextDocument): boolean {
    const file = document instanceof vscode.Uri ? document : document.uri;
    const relative = path.relative(this.gm.dir, file.fsPath);
    return (
      !relative || (!relative.startsWith('..') && !path.isAbsolute(relative))
    );
  }

  /**
   * A link to the GameMaker manual page for a built-in function or variable,
   * using the help index of the project's GameMaker version (or any cached
   * version).
   */
  async helpLink(name: string): Promise<string> {
    this.helpLinksFile ||= (async () => {
      try {
        const launcher = stitchConfig.launcherOptions;
        const ide =
          (await findIde(this.ideVersion, launcher)) ??
          (await listAvailableIdes(launcher))[0];
        if (!ide) return {};
        return JSON.parse(await fs.readFile(ide.helpKeywordsFile, 'utf8'));
      } catch (err) {
        logger.warn('Could not load the GameMaker help index', err);
        return {};
      }
    })();
    const links = await this.helpLinksFile;
    const baseUrl = `https://beta-manual.yoyogames.com/#t=`;
    if (name && name in links) {
      return `${baseUrl}${encodeURIComponent(links[name])}.htm`;
    } else if (name) {
      return `${baseUrl}Content.htm&rhsearch=${encodeURIComponent(name)}&ux=${encodeURIComponent(name)}`;
    }
    return `${baseUrl}Content.htm`;
  }

  async dispose() {
    await this.client?.stop().catch(() => undefined);
    this.client = undefined;
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
          const running = await openProject(this.gm.yypPath, {
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
            project: this.gm.yypPath,
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
}
