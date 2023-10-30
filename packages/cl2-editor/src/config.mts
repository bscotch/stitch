import vscode from 'vscode';

class CrashlandsConfig {
  get config() {
    return vscode.workspace.getConfiguration('crashlands');
  }

  get backupDelay() {
    return this.config.get<number>('editor.backup.delay') ?? 1000;
  }
}

export const crashlandsConfig = new CrashlandsConfig();
