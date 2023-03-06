import { createApiServer } from '@bscotch/stitch-server/server';
import { handler } from '@bscotch/stitch-ui';
import { app } from 'electron';
import isInstalling from 'electron-squirrel-startup';
import { StitchWindow } from './lib/window.mjs';

//#region AUTO UPDATE
if (isInstalling) {
  app.quit();
}
//#endregion

app.userAgentFallback = 'Mozilla/5.0 (Stitch Desktop)';
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const server = await createApiServer({ frontendHandler: handler });
await app.whenReady();

await StitchWindow.create({ port: server.port });
