import type { Asset } from '@bscotch/gml-parser';
import type {
  IgorExitedMessage,
  IgorWebviewExtensionPostLogs,
  IgorWebviewExtensionPostRun,
  IgorWebviewLog,
  IgorWebviewPosts,
  WebviewResetMessage,
} from '@local-vscode/shared';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import vscode from 'vscode';
import html from '../webviews/build/igor.html';
import { assertLoudly } from './assert.mjs';
import { StitchEvents, stitchEvents } from './events.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';

export class StitchIgorView implements vscode.WebviewViewProvider {
  readonly viewType = 'bscotch-stitch-igor';
  protected container?: vscode.WebviewView;
  public editing: Asset<'sprites'> | undefined;
  public zooms = new Map<Asset<'sprites'>, number>();
  protected lastRequest?: StitchEvents.RequestRunInWebview['payload'][0];
  protected runner?: ChildProcessWithoutNullStreams;

  constructor(readonly workspace: StitchWorkspace) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this.container = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getWebviewContent(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'colorSelected': {
          vscode.window.activeTextEditor?.insertSnippet(
            new vscode.SnippetString(`#${data.value}`),
          );
          break;
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

  async run(event: StitchEvents.RequestRunInWebview['payload'][0]) {
    assertLoudly(this.container, 'Runner container not initialized!');
    this.lastRequest = event;
    const runMessage: IgorWebviewExtensionPostRun = {
      kind: 'run',
      runtimeVersion: event.runtime.version,
      cmd: event.cmd,
      args: event.args,
      projectName: event.project.name,
    };
    const webview = this.container.webview;
    webview.postMessage({ kind: 'reset' } satisfies WebviewResetMessage);
    webview.onDidReceiveMessage(async (message: IgorWebviewPosts) => {
      if (message.kind === 'ready') {
        if (this.runner && this.runner.exitCode === null) {
          // TODO: Tell the webview to reload its logs?
        } else {
          await webview.postMessage(runMessage);
          this.runner = spawn(event.cmd, event.args, { shell: true });
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
      }
    });
  }

  static register(workspace: StitchWorkspace) {
    const igorView = new StitchIgorView(workspace);
    stitchEvents.on('request-run-project-in-webview', (payload) => {
      igorView.run(payload);
    });
    return [
      vscode.window.registerWebviewViewProvider(igorView.viewType, igorView),
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
