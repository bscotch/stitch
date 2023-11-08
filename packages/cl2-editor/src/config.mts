import vscode from 'vscode';

class CrashlandsConfig {
  get config() {
    return vscode.workspace.getConfiguration('crashlands');
  }

  get backupDelay() {
    return this.config.get<number>('editor.backup.delay') ?? 1000;
  }

  get parseDelay() {
    return this.config.get<number>('editor.parse.delay') ?? 50;
  }
}

export const crashlandsConfig = new CrashlandsConfig();
