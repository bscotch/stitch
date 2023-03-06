import { app, Menu, shell } from 'electron';
import path from 'path';
import { GlobalConfig } from './Config.mjs';
import { bundleRoot } from './constants.mjs';
import { BrowserWindow, dialog, ipcMain } from './importBridge.mjs';
import { createMenu } from './menu.mjs';
import { Updater } from './updater.mjs';

export class StitchWindow {
  readonly config = new GlobalConfig();

  protected constructor(protected window: Electron.BrowserWindow) {}

  static async create(options: { port: number }): Promise<StitchWindow> {
    const window = new BrowserWindow({
      width: 1024,
      height: 720,
      icon: 'assets/stitch-logo.png',
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      closable: true,
      fullscreenable: false,
      maxWidth: 1024,
      minWidth: 840,
      minHeight: 330,
      webPreferences: {
        preload: path.join(bundleRoot, 'preload.cjs'),
      },
    });
    const desktop = new StitchWindow(window);

    ipcMain.handle(
      'pickDirectory',
      async (
        event,
        options?: { buttonLabel?: string; message?: string; title?: string },
      ) => {
        const { canceled, filePaths } = await dialog.showOpenDialog(window, {
          properties: ['openDirectory'],
          ...options,
        });
        if (canceled) {
          return null;
        }
        return filePaths[0];
      },
    );

    ipcMain.handle('version', () => {
      return app.getVersion();
    });

    // and load the index.html of the app.
    await window.loadURL(`http://localhost:${options.port}`);
    window.webContents.setWindowOpenHandler((details) => {
      if (new URL(details.url).hostname !== 'localhost') {
        console.log('opening external url', details.url);
        shell.openExternal(details.url);
      }
      return {
        action: 'deny',
      };
    });
    const updater = new Updater(window);
    void updater.startPollingForUpdates();
    const menu = createMenu(updater);

    Menu.setApplicationMenu(menu);
    return desktop;
  }
}
