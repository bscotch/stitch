import type { Asset } from '@bscotch/gml-parser';
import type {
  IgorExitedMessage,
  IgorWebviewExtensionPostLogs,
  IgorWebviewExtensionPostRun,
  IgorWebviewLog,
} from '@local-vscode/shared';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import vscode from 'vscode';
import html from '../webviews/build/igor.html';
import { assertLoudly } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import { StitchEvents, stitchEvents } from './events.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { registerCommand } from './lib.mjs';

export class StitchIgorView implements vscode.WebviewViewProvider {
  readonly viewType = 'bscotch-stitch-igor';
  protected container?: vscode.WebviewView;
  public editing: Asset<'sprites'> | undefined;
  public zooms = new Map<Asset<'sprites'>, number>();
  protected lastRequest?: StitchEvents.RequestRunInWebview['payload'][0];
  protected runner?: ChildProcessWithoutNullStreams;

  constructor(readonly workspace: StitchWorkspace) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    if (this.container) return;
    this.container = webviewView;
    const webview = webviewView.webview;
    webview.options = { enableScripts: true, enableCommandUris: true };
    webview.html = this.getWebviewContent(webview);
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

  async run(event: StitchEvents.RequestRunInWebview['payload'][0]) {
    assertLoudly(this.container, 'Runner container not initialized!');
    if (this.runner && this.runner.exitCode === null) {
      // Kill the current instance
      this.runner.kill();
    }
    // Make sure our config is up to date for styling
    await event.project.reloadConfig();
    this.lastRequest = event;
    const runMessage: IgorWebviewExtensionPostRun = {
      kind: 'run',
      runtimeVersion: event.runtime.version,
      cmd: event.cmd,
      args: event.args,
      projectName: event.project.name,
      projectDir: event.project.dir.absolute,
      config: {
        fontFamily: stitchConfig.runnerViewFontFamily,
        fontSize: stitchConfig.runnerViewFontSize,
        ...event.project.config.gameConsoleStyle,
      },
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
    return [
      vscode.window.registerWebviewViewProvider(igorView.viewType, igorView),
      registerCommand('stitch.runner.toggleSearchWidget', () => {
        igorView.container?.webview.postMessage({ kind: 'toggle-search' });
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
