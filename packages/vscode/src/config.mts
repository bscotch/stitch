import type { Channel } from '@bscotch/gamemaker-releases';
import vscode from 'vscode';

interface SpriteSourcesConfig {
  [projectPath: string]: string[];
}

class StitchConfig {
  public context!: vscode.ExtensionContext;

  get config() {
    return vscode.workspace.getConfiguration('stitch');
  }

  get spriteSources(): SpriteSourcesConfig {
    const sources =
      this.config.get<{ [projectPath: string]: string[] }>('sprites.sources') ||
      {};
    // Make sure it's the right type!
    if (Array.isArray(sources)) {
      this.config.update('sprites.sources', {});
      return {};
    }
    return { ...sources };
  }
  set spriteSources(sources: SpriteSourcesConfig) {
    // Want to store it as an *unsynced* value at the *user* level,
    // so it doesn't get synced across devices. This means it has to
    // be stored independent of the workspace.
    this.config.update('sprites.sources', { ...sources });
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
  get autoDeclaredGlobalsPrefixes() {
    return (
      this.config.get<string[]>('diagnostics.autoDeclaredGlobalsPatterns') || []
    );
  }
  get releaseNotesChannels(): Channel[] {
    return (
      this.config.get<Channel[]>('gameMaker.releases.notes.channels') || []
    );
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

export const stitchConfig = new StitchConfig();
