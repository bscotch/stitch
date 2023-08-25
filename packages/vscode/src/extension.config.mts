import type { Channel } from '@bscotch/gamemaker-releases';
import { randomString } from '@bscotch/utility';
import vscode from 'vscode';

export class StitchConfig {
  get config() {
    return vscode.workspace.getConfiguration('stitch');
  }
  // get alertOnSpriteChange() {
  //   return this.config.get<boolean>('sprites.alertOnChange') ?? true;
  // }
  get cleanOnSpineSpriteChange() {
    return (
      this.config.get<boolean>('sprites.cleanOnSpineSpriteChange') ?? false
    );
  }
  get suppressDiagnosticsInGroups() {
    return this.config.get<string[]>('diagnostics.suppressGroups') || [];
  }

  get userId() {
    let userId = this.config.get<string>('telemetry.userId');
    if (!userId) {
      // Create a random user ID to help associate telemetry data
      userId = randomString(6, 'base64');
      this.config.update('telemetry.userId', userId);
    }
    return this.config.get<string>('telemetry.userId');
  }
  get releaseNotesChannels(): Channel[] {
    return (
      this.config.get<Channel[]>('gameMaker.releases.notes.channels') || []
    );
  }
  get enableSendingLogs() {
    return this.config.get<boolean>('telemetry.enable') ?? false;
  }
  get associatedIssue() {
    return this.config.get<number>('telemetry.associatedIssue') || undefined;
  }
  get enableFunctionSignatureStatus() {
    return this.config.get<boolean>('editing.signatureStatus.enable');
  }
  get autocompleteIgnoredPrefix() {
    return this.config.get<string | null>('editing.autocomplete.ignoredPrefix');
  }
  get symbolsIncludeInstanceVars() {
    return (
      this.config.get<boolean>(
        'editing.workspaceSymbols.includeInstanceVariables',
      ) ?? true
    );
  }
  get symbolsIncludeLocalVars() {
    return (
      this.config.get<boolean>(
        'editing.workspaceSymbols.includeLocalVariables',
      ) ?? true
    );
  }
  get symbolsMaxSearchResults() {
    return this.config.get<number>('editing.workspaceSymbols.maxResults') || 30;
  }
  get functionSignatureStatusAlignment(): vscode.StatusBarAlignment {
    const alignment = this.config.get<'left' | 'right'>(
      'editing.signatureStatus.alignment',
    );
    if (alignment === 'left') {
      return vscode.StatusBarAlignment.Left;
    }
    return vscode.StatusBarAlignment.Right;
  }
  get enableYyFormatting() {
    return this.config.get<boolean>('yy.format.enable');
  }
  get runCompilerDefault(): 'vm' | 'yyc' {
    return (
      this.config.get<string>('run.defaultCompiler') || 'vm'
    ).toLowerCase() as 'vm' | 'yyc';
  }
  get runConfigDefault(): string | null {
    return this.config.get<string>('run.defaultConfig') || null;
  }
  get reprocessOnTypeDelay(): number {
    return this.config.get<number>('editing.reprocessOnTypeDelay') || 50;
  }
  get externalChangeDelay(): number {
    return this.config.get<number>('editing.externalChangeDelay') || 100;
  }
}

export const config = new StitchConfig();
