/**
 * Starting the GML language server for a project, and talking to it.
 */
import {
  statusNotification,
  type GmlServerInitializationOptions,
  type StatusParams,
} from '@bscotch/gml-language-server/protocol';
import vscode from 'vscode';
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from 'vscode-languageclient/node';
import { stitchConfig } from './config.mjs';
import type { StitchProject } from './extension.project.mjs';
import { logger, showErrorMessage } from './log.mjs';
import { findGmlSpecs } from './projectDiscovery.mjs';

let outputChannel: vscode.LogOutputChannel | undefined;

/** Trust hover markdown, so sprite previews (local images) render */
function trustHover(hover: vscode.Hover | null | undefined) {
  for (const content of hover?.contents ?? []) {
    if (content instanceof vscode.MarkdownString) {
      content.supportHtml = true;
      content.isTrusted = true;
    }
  }
  return hover;
}

/**
 * Start the language server for a project. Resolves once the server is
 * running; analysis continues in the background, with progress shown in a
 * notification.
 */
export async function startLanguageClient(
  ctx: vscode.ExtensionContext,
  project: StitchProject,
  fileWatchers: vscode.FileSystemWatcher[],
): Promise<LanguageClient> {
  const specs = await findGmlSpecs({
    projectDir: project.dir.absolute,
    ideVersion: project.ideVersion,
    runtimeVersion: project.config.runtimeVersion,
    launcher: stitchConfig.launcherOptions,
  });
  logger.info(
    specs.length
      ? `Using GmlSpec files: ${specs.join(', ')}`
      : 'Using the GmlSpec bundled with Stitch',
  );

  const module = ctx.asAbsolutePath('dist/server.js');
  const serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6010'] },
    },
  };
  const initializationOptions: GmlServerInitializationOptions = {
    yypPath: project.yypPath.absolute,
    specs,
    settings: stitchConfig.serverSettings,
  };
  outputChannel ||= vscode.window.createOutputChannel(
    'Stitch Language Server',
    { log: true },
  );
  const clientOptions: LanguageClientOptions = {
    // (The server ignores GML files that aren't part of the project)
    documentSelector: [{ scheme: 'file', language: 'gml' }],
    synchronize: { fileEvents: fileWatchers },
    initializationOptions,
    outputChannel,
    middleware: {
      provideHover: async (document, position, token, next) =>
        trustHover(await next(document, position, token)),
      provideDocumentFormattingEdits: (document, options, token, next) =>
        stitchConfig.enableGmlFormatting
          ? next(document, options, token)
          : undefined,
    },
  };

  const client = new LanguageClient(
    'stitch-gml',
    'Stitch GML',
    serverOptions,
    clientOptions,
  );
  showLoadProgress(client, project);
  await client.start();
  return client;
}

/** Show the server's loading progress in a notification */
function showLoadProgress(client: LanguageClient, project: StitchProject) {
  let finish: (() => void) | undefined;
  client.onNotification(statusNotification, (status: StatusParams) => {
    if (status.state === 'loading' && !finish) {
      void vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Stitch: Analyzing ${project.name}`,
          cancellable: false,
        },
        () => new Promise<void>((resolve) => (finish = resolve)),
      );
      return;
    }
    finish?.();
    finish = undefined;
    if (status.state === 'ready') {
      logger.info(
        `Analyzed ${status.files} GML files in ${((status.ms ?? 0) / 1000).toFixed(1)}s`,
      );
    } else if (status.state === 'error') {
      void showErrorMessage(
        `Stitch could not analyze ${project.name}: ${status.message}. See the "Stitch Language Server" output for details.`,
      );
    }
  });
}

/** Send updated settings to a project's language server */
export function sendSettings(client: LanguageClient | undefined) {
  void client?.sendNotification('workspace/didChangeConfiguration', {
    settings: stitchConfig.serverSettings,
  });
}
