import { applyWSSHandler } from '@trpc/server/adapters/ws';
import express, { type Express, type Handler } from 'express';
import type { AddressInfo } from 'net';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import {
  corsMiddleware,
  serveProjectAssetSource,
  serveProjectFile,
  startServer,
} from './http.js';
import { router } from './trpc.router.js';

export { Api } from './trpc.router.js';

function createContextGenerator(info: { port: number }) {
  return () => ({
    config,
    ...info,
  });
}

export async function createApiServer(options: {
  port?: number;
  frontendHandler?: Handler[] | Handler;
}): Promise<{
  wss: WebSocketServer;
  http: Express;
  port: number;
}> {
  await config.ensureExists();
  const app = express();
  app.use(corsMiddleware);
  app.get('/projects/:projectId/files/:path(.+)', serveProjectFile);
  app.get(
    '/projects/:projectId/sources/:type/:sourceId/files/:fileId',
    serveProjectAssetSource,
  );

  const server = await startServer(app, options.port);
  const address = server.address() as AddressInfo;
  if (options.frontendHandler) {
    app.use(options.frontendHandler);
  }

  const wss = new WebSocketServer({ server });
  const handler = applyWSSHandler({
    wss,
    router,
    createContext: createContextGenerator({ port: address.port }),
  });
  process.on('SIGTERM', () => {
    console.log('SIGTERM');
    handler.broadcastReconnectNotification();
    wss.close();
    server.close();
  });
  console.log('Stitch Desktop Server: Listening on port', address.port);
  return { http: app, wss, port: address.port };
}
