import { assert } from '@bscotch/utility';
import { autoUpdater, dialog, type BrowserWindow } from 'electron';
import { updateFeed } from './constants.mjs';

export class Updater {
  protected static count = 0;
  currentUpdateCheck: null | Promise<boolean> = null;

  constructor(readonly window: BrowserWindow) {
    assert(Updater.count === 0, 'Updater must be a singleton');
    Updater.count++;
    autoUpdater.setFeedURL({
      url: updateFeed,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      const dialogOpts: Electron.MessageBoxOptions = {
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: 'A new version has been downloaded. Restart to update!',
      };
      this.notify({
        kind: 'success',
        text: 'Update downloaded! Restart to apply.',
      });

      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) autoUpdater.quitAndInstall();
      });
    });
  }

  notify(alert: {
    kind: 'error' | 'warning' | 'success' | 'info';
    text: string;
    icon?: string;
  }) {
    this.window.webContents.send('notify', { id: 'updater', ttl: 3, ...alert });
  }

  checkForUpdates(polling = false): Promise<boolean> {
    if (this.currentUpdateCheck) {
      return this.currentUpdateCheck;
    }
    autoUpdater.checkForUpdates();
    this.currentUpdateCheck = new Promise((res, rej) => {
      const parent = this;
      function replyAvailable() {
        res(true);
        if (!polling) {
          parent.notify({
            kind: 'success',
            text: 'Update available! Downloading...',
          });
        }
        parent.currentUpdateCheck = null;
        autoUpdater.off('update-unavailable', replyUnavailable);
        autoUpdater.off('error', replyError);
      }
      function replyUnavailable() {
        res(false);
        if (!polling) {
          parent.notify({
            kind: 'warning',
            text: 'No updates available.',
          });
        }
        parent.currentUpdateCheck = null;
        autoUpdater.off('update-available', replyAvailable);
        autoUpdater.off('error', replyError);
      }
      function replyError(err: any) {
        rej(err);
        if (!polling) {
          parent.notify({
            kind: 'error',
            text: `Update check failed with message: ${err?.message}`,
          });
        }
        parent.currentUpdateCheck = null;
        autoUpdater.off('update-available', replyAvailable);
        autoUpdater.off('update-unavailable', replyUnavailable);
      }
      autoUpdater.once('update-available', replyAvailable);
      autoUpdater.once('update-not-available', replyUnavailable);
      autoUpdater.once('error', replyError);
    });
    return this.currentUpdateCheck;
  }

  async startPollingForUpdates(intervalMinutes = 10) {
    // Check immediately
    await this.checkForUpdates(true);
    // THen every 10 minutes (or whatever)
    setInterval(
      async () => {
        await this.checkForUpdates(true);
      },
      1000 * 60 * intervalMinutes,
    );
  }
}
