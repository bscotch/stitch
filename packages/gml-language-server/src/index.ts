import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { startServer, type GmlLanguageServer } from './server.ts';

export * from './protocol.ts';
export { GmlLanguageServer, startServer } from './server.ts';
export { ProjectSession, type SessionOptions } from './session.ts';
export { pathToUri, uriToPath } from './uri.ts';

/**
 * Run the server in this process, talking to the client over the transport
 * given on the command line (`--stdio`, `--node-ipc` or `--socket=<port>`).
 */
export function runServer(): GmlLanguageServer {
  return startServer(createConnection(ProposedFeatures.all));
}
