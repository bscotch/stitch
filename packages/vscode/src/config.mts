import type { LauncherOptions } from '@bscotch/stitch-launcher';
import vscode from 'vscode';
import { logger } from './log.mjs';

/** Release channels shown by default (v2 channel names) */
export const defaultReleaseChannels = ['lts2026', 'beta'];

/**
 * Channel names used before the v2 releases feed, and their v2 names.
 * The legacy "lts" channel covered the LTS 2022 series.
 */
const legacyChannelNames: Record<string, string[]> = {
  stable: ['monthly'],
  lts: ['lts2022', 'lts2026'],
};

/** Convert legacy channel names to v2 names, removing duplicates */
export function migrateChannelNames(channels: string[]): string[] {
  return [...new Set(channels.flatMap((c) => legacyChannelNames[c] ?? [c]))];
}

export function hasLegacyChannelNames(channels: string[]): boolean {
  return channels.some((c) => c in legacyChannelNames);
}

class StitchConfig {
  public context!: vscode.ExtensionContext;

  get config() {
    return vscode.workspace.getConfiguration('stitch');
  }

  get allowedProjects() {
    return this.config.get<string[]>('assets.filters.allowedProjects') || [];
  }

  get killOthersOnRun() {
    return this.config.get<boolean>('run.killOthers') ?? true;
  }

  get sortSpriteSourceChangesBy() {
    return (
      this.config.get<'recency' | 'name'>('sprites.sources.sortChangesBy') ??
      'recency'
    );
  }
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
  get releaseNotesChannels(): string[] {
    // Settings are migrated on activation, but convert here too in case
    // a legacy value comes from somewhere that couldn't be migrated.
    return migrateChannelNames(
      this.config.get<string[]>('gameMaker.releases.notes.channels') ||
        defaultReleaseChannels,
    );
  }
  get disableGameMakerUpdatePrompt(): boolean {
    return (
      this.config.get<boolean>('gameMaker.disableGameMakerUpdatePrompt') ?? true
    );
  }
  get ideCacheDir(): string | undefined {
    return (
      this.config.get<string>('gameMaker.launcher.ideCacheDir') || undefined
    );
  }
  get downloadsDir(): string | undefined {
    return (
      this.config.get<string>('gameMaker.launcher.downloadsDir') || undefined
    );
  }
  get sevenZipPath(): string | undefined {
    return (
      this.config.get<string>('gameMaker.launcher.sevenZipPath') || undefined
    );
  }
  /** Options for `@bscotch/stitch-launcher`, from the user's settings */
  get launcherOptions(): LauncherOptions {
    return {
      ideCacheDir: this.ideCacheDir,
      downloadsDir: this.downloadsDir,
      sevenZipPath: this.sevenZipPath,
      logger: logger.withPrefix('LAUNCHER'),
    };
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
  get runInTerminal(): boolean {
    return this.config.get<boolean>('run.inTerminal') ?? true;
  }
  get runnerViewFontFamily(): string | null {
    return this.config.get<string>('runView.fontFamily') ?? '';
  }
  get runnerViewFontSize(): number {
    return this.config.get<number>('runView.fontSize') ?? 0;
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
    return this.config.get<number>('editing.reprocessOnTypeDelay') ?? 50;
  }
  get externalChangeDelay(): number {
    return this.config.get<number>('editing.externalChangeDelay') ?? 100;
  }
  get initialMinSpriteEditorWidth(): number {
    return this.config.get<number>('sprites.editor.minInitialWidth') || 128;
  }
  get spriteAutoImportDelay(): number {
    return (
      this.config.get<number>('sprites.sources.watcherDebounceInterval') ?? 1000
    );
  }
  get spriteAutoImportOnStartup() {
    return this.config.get<boolean>('sprites.sources.watchOnStartup') ?? false;
  }
  get openFoldersOnFilter() {
    return this.config.get<boolean>('assets.filters.openAllFolders') ?? false;
  }
}

export const stitchConfig = new StitchConfig();
