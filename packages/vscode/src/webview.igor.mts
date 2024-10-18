import type { Asset } from '@bscotch/gml-parser';
import type {
  IgorExitedMessage,
  IgorWebviewConfig,
  IgorWebviewExtensionPostLogs,
  IgorWebviewExtensionPostRun,
  IgorWebviewLog,
  IgorWebviewPosts,
} from '@local-vscode/shared';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import vscode from 'vscode';
import html from '../webviews/build/igor.html';
import { assertLoudly } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import { StitchEvents, stitchEvents } from './events.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { registerCommand, uriFromCodeFile } from './lib.mjs';

export class StitchIgorView implements vscode.WebviewViewProvider {
  readonly viewType = 'bscotch-stitch-igor';
  protected container?: vscode.WebviewView;
  public editing: Asset<'sprites'> | undefined;
  public zooms = new Map<Asset<'sprites'>, number>();
  protected lastRequest?: StitchEvents.RequestRunInWebview['payload'][0];
  protected runner?: ChildProcessWithoutNullStreams;

  constructor(readonly workspace: StitchWorkspace) {}

  async reveal() {
    await vscode.commands.executeCommand(`${this.viewType}.focus`);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    if (this.container) return;
    this.container = webviewView;
    const webview = webviewView.webview;
    webview.options = { enableScripts: true, enableCommandUris: true };
    webview.html = this.getWebviewContent(webview);
    webview.onDidReceiveMessage(async (e: IgorWebviewPosts) => {
      if (e.kind === 'open') {
        // Go to the asset in the editor
        const asset = this.workspace
          .getActiveProject()
          ?.getAssetByName(e.asset);
        assertLoudly(asset, `Asset not found: ${e.asset}`);
        const file =
          e.type === 'objects' && e.event
            ? (asset.getEventByName(e.event as any) ?? asset.gmlFile)
            : asset.gmlFile;
        const editor = await vscode.window.showTextDocument(
          uriFromCodeFile(file),
        );
        // Go to the line
        if (e.line) {
          const line = e.line - 1;
          const range = editor.document.lineAt(line).range;
          editor.selection = new vscode.Selection(range.start, range.start);
          editor.revealRange(range);
        }
      }
    });
  }

  protected getWebviewContent(webview: vscode.Webview) {
    let preparedHtml = html;
    // Add the <base> tag so that relative paths work
    const basePath = vscode.Uri.joinPath(
      this.workspace.ctx.extensionUri,
      'webviews',
      'build',
    );
    const compatibleBasePath = webview.asWebviewUri(basePath);
    preparedHtml = preparedHtml.replace(
      '<head>',
      `<head><base href="${compatibleBasePath}/">`,
    );
    return preparedHtml;
  }

  protected async getConfig(): Promise<IgorWebviewConfig> {
    await this.lastRequest?.project.reloadConfig();
    return {
      fontFamily: stitchConfig.runnerViewFontFamily,
      fontSize: stitchConfig.runnerViewFontSize,
      ...this.lastRequest?.project.config.gameConsoleStyle,
    };
  }

  async refreshConfig() {
    this.container?.webview.postMessage({
      kind: 'config',
      config: await this.getConfig(),
    });
  }

  kill() {
    const pid = this.runner?.pid;
    if (typeof pid !== 'number') return;
    if (this.runner?.exitCode !== null) {
      // Then it's already dead
      return;
    }
    // Doesn't terminate on Windows...
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', `${pid}`, '/f', '/t']);
    } else {
      this.runner.kill();
    }
  }

  async run(event: StitchEvents.RequestRunInWebview['payload'][0]) {
    await this.reveal(); // So that VSCode creates the container
    assertLoudly(
      this.container,
      'Runner container not initialized! Please try again.',
    );
    this.kill();
    // Make sure our config is up to date for styling
    this.lastRequest = event;
    const runMessage: IgorWebviewExtensionPostRun = {
      kind: 'run',
      runtimeVersion: event.runtime.version,
      cmd: event.cmd,
      args: event.args,
      projectName: event.project.name,
      projectDir: event.project.dir.absolute,
      config: await this.getConfig(),
    };
    const webview = this.container.webview;

    // Tell the view we're about to run!
    await webview.postMessage(runMessage);

    this.runner = spawn(event.cmd, event.args, {
      shell: true,
      env: {
        ...process.env,
        STITCH_VSCODE_RUNNER: 'custom',
      },
    });
    this.runner.stdout.on('data', (data) => {
      webview.postMessage(messagesFromStdio(data, 'stdout'));
    });
    this.runner.stderr.on('data', (data) => {
      webview.postMessage(messagesFromStdio(data, 'stderr'));
    });
    this.runner.on('exit', (code) => {
      this.runner = undefined;
      webview.postMessage({
        kind: 'exited',
        code,
      } satisfies IgorExitedMessage);
    });
  }

  static register(workspace: StitchWorkspace) {
    const igorView = new StitchIgorView(workspace);
    stitchEvents.on('request-run-project-in-webview', (payload) => {
      igorView.run(payload);
    });
    stitchEvents.on('request-kill-project-in-webview', () => {
      console.log('Killing runner', !!igorView.runner);
      igorView.kill();
    });
    return [
      vscode.window.registerWebviewViewProvider(igorView.viewType, igorView),
      registerCommand('stitch.runner.toggleSearchWidget', () => {
        igorView.container?.webview.postMessage({ kind: 'toggle-search' });
      }),
      registerCommand('stitch.runner.refresh', () => {
        igorView.refreshConfig();
      }),
    ];
  }
}

function messagesFromStdio(
  data: Buffer,
  stream: 'stdout' | 'stderr',
): IgorWebviewExtensionPostLogs {
  const logs: IgorWebviewLog[] = data
    .toString()
    .split(/\r?\n/)
    .map((message) => ({ kind: stream, message }))
    .filter((x) => !!x.message);
  return { kind: 'log', logs };
}
