import { Asset, isAssetOfKind } from '@bscotch/gml-parser';
import { Pathy, pathy } from '@bscotch/pathy';
import {
  SpriteDest,
  SpriteSource,
  SpriteSourceStage,
} from '@bscotch/sprite-source';
import { sequential } from '@bscotch/utility';
import path from 'path';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import { stitchEvents } from './events.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { ObjectSpriteItem } from './inspector.mjs';
import { registerCommand, sortAlphaInsensitive } from './lib.mjs';
import { logger, showErrorMessage } from './log.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';

type Item =
  | SpriteSourcesFolder
  | SpriteSourceFolder
  | SpriteSourceStageItem
  | RecentlyChangedFolder
  | SpriteItem;

interface SpriteChangeInfo {
  when: Date;
}

export class SpriteSourcesTree implements vscode.TreeDataProvider<Item> {
  view!: vscode.TreeView<Item>;
  protected _currentProject?: GameMakerProject;
  /** Map of {fullPath: watcher} */
  static sourceWatchers: Map<string, vscode.FileSystemWatcher[]> = new Map();
  importing = false;

  // Map of <project: spriteName: SpriteChangeInfo>
  static recentlyChangedSprites: Map<
    GameMakerProject,
    Map<string, SpriteChangeInfo>
  > = new Map();

  private _onDidChangeTreeData: vscode.EventEmitter<
    Item | undefined | null | void
  > = new vscode.EventEmitter<Item | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidCollapseElement: vscode.EventEmitter<
    Item | undefined | null | void
  > = new vscode.EventEmitter<Item | undefined | null | void>();
  readonly onDidCollapseElement = this._onDidCollapseElement.event;

  constructor(readonly workspace: StitchWorkspace) {
    // Whenever a project changes we may have different sprites to show
    stitchEvents.on('project-changed', () => this.rebuild());
    stitchEvents.on(
      'asset-changed',
      (asset) => isAssetOfKind(asset, 'sprites') && this.rebuild(),
    );
  }

  get currentProject() {
    return this._currentProject;
  }
  set currentProject(project: GameMakerProject | undefined) {
    if (this._currentProject === project) return;
    this._currentProject = project;
    // Unset the watchers
    SpriteSourcesTree.clearWatchers();
    this.rebuild();
  }

  static clearWatchers() {
    SpriteSourcesTree.sourceWatchers.forEach((watchers) =>
      watchers.forEach((watcher) => watcher.dispose()),
    );
    SpriteSourcesTree.sourceWatchers = new Map();
  }

  @sequential
  async importSprites() {
    const project = this.currentProject;
    assertLoudly(project, 'No active project.');

    const dest = await SpriteDest.from(project.yypPath.absolute);

    // Prep the tracker for this project
    SpriteSourcesTree.recentlyChangedSprites.set(
      project,
      SpriteSourcesTree.recentlyChangedSprites.get(project) || new Map(),
    );
    const projectChanges =
      SpriteSourcesTree.recentlyChangedSprites.get(project)!;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Importing sprites`,
        cancellable: false,
      },
      async (progress) => {
        await project.reloadConfig();
        const actions = await dest.import(undefined, progress, {
          allowedNamePatterns: project.config.newSpriteRules?.allowedNames,
        });

        // Summarize all isues into a single popup
        const totalIssues = dest.issues.length;
        if (totalIssues) {
          const displayIssues = dest.issues.slice(0, 5);
          const moreIssues = totalIssues - displayIssues.length;
          logger.error(dest.issues);
          showErrorMessage(
            `There were ${totalIssues} issues importing sprites:\n\n${displayIssues
              .map(
                (issue) =>
                  `${issue.message}${
                    issue.cause && issue.cause instanceof Error
                      ? ` (${issue.cause.message})`
                      : ''
                  }`,
              )
              .join('\n\n')}${
              moreIssues ? `\n\n...and ${moreIssues} more` : ''
            }`,
          );
        }

        // Add the changes to the recently changed list
        for (const action of actions || []) {
          // Ensure the

          projectChanges.set(action.resource.name, {
            when: new Date(),
          });
        }
      },
    );

    this.rebuild();
  }

  @sequential
  async deleteSpriteSource(source: SpriteSourceFolder) {
    const dest = await SpriteDest.from(source.project.yypPath.absolute);
    const config = await dest.loadConfig();
    const sourceIndex =
      config.sources?.findIndex((s) => s.source === source.relativeSourceDir) ??
      -1;
    assertLoudly(sourceIndex >= 0, 'Could not find sprite source in settings.');
    config.sources!.splice(sourceIndex, 1);
    await dest.loadConfig(config); // To resave the config
    this.rebuild();
  }

  @sequential
  async clearCache(source: SpriteSourceFolder | undefined) {
    if (!source) {
      assertLoudly(this.currentProject, 'No active project.');
      // Then clear the destination cache for the current project
      const dest = await SpriteDest.from(this.currentProject.yypPath.absolute);
      await dest.cacheFile.delete();
    } else {
      // Then clear the cache for the given source
      try {
        const sourceDir = await SpriteSource.from(source.sourceDir.absolute);
        await sourceDir.cacheFile.delete();
      } catch (err) {
        logger.error(
          `Error clearing cache for ${source.sourceDir.absolute}`,
          err,
        );
      }
    }
    this.rebuild();
  }

  async addSpriteSource() {
    assertLoudly(
      this.workspace.projects.length > 0,
      'No projects loaded. Cannot create a Sprite Source without a target project.',
    );

    // Have the user choose a folder
    const rawSource = (
      await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Add Source',
        title: 'Choose a Sprite Source folder',
      })
    )?.[0];
    if (!rawSource) {
      logger.info('No source folder selected.');
      return;
    }
    const source = await SpriteSource.from(rawSource.fsPath);

    // Get the target project
    const targetProjectName =
      this.workspace.projects.length === 1
        ? this.workspace.projects[0].name
        : await vscode.window.showQuickPick(
            this.workspace.projects.map((p) => p.name),
          );
    if (!targetProjectName) {
      logger.info('No target project selected.');
      return;
    }
    const targetProject = this.workspace.projects.find(
      (p) => p.name === targetProjectName,
    )!;

    // Add the source to the config
    /** The path is stored relative to the project folder */
    const relativeSourcePath = targetProject.dir.relativeTo(source.spritesRoot);
    const dest = await SpriteDest.from(targetProject.yypPath.absolute);
    const config = await dest.loadConfig();
    config.sources ||= [];
    assertLoudly(
      !config.sources.find((s) => s.source === relativeSourcePath),
      'Source already exists in config.',
    );
    config.sources.push({
      source: relativeSourcePath,
    });
    // Reload with this new config as an override
    await dest.loadConfig(config);
    this.rebuild();
  }

  async addSpriteSourceStage(sourceFolder: SpriteSourceFolder) {
    // Have the user choose a folder
    const stageDir = (
      await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Add Stage',
        title: 'Choose a Sprite Source Staging folder',
      })
    )?.[0];
    if (!stageDir) {
      logger.info('No source folder selected.');
      return;
    }
    const source = await SpriteSource.from(sourceFolder.sourceDir);
    const config = await source.loadConfig();
    config.staging ||= [];
    config.staging.push({
      dir: source.spritesRoot.relativeTo(stageDir.fsPath),
      transforms: [],
    });
    await source.loadConfig(config);

    this._onDidChangeTreeData.fire(sourceFolder);
  }

  async getChildren(element?: Item): Promise<Item[]> {
    if (!element) {
      const project = this.workspace.getActiveProject();
      if (!project) {
        logger.info("No active project. Can't load sprite sources.");
        return [];
      }
      return [
        new SpriteSourcesFolder(project),
        new RecentlyChangedFolder(project),
      ];
    } else if (
      'getChildren' in element &&
      typeof element.getChildren === 'function'
    ) {
      return (await element.getChildren()) as Item[];
    }
    return [];
  }

  getTreeItem(element: SpriteSourceFolder): SpriteSourceFolder {
    return element;
  }

  rebuild() {
    this._onDidChangeTreeData.fire();
    return this;
  }

  static register(workspace: StitchWorkspace): vscode.Disposable[] {
    const tree = new SpriteSourcesTree(workspace);
    tree.view = vscode.window.createTreeView('bscotch-stitch-sprite-sources', {
      treeDataProvider: tree,
    });
    tree.currentProject = workspace.getActiveProject();

    // Rebuild the tree with some frequency to update the timestamps
    setInterval(() => tree.rebuild(), 1000 * 60 * 1);

    // Return subscriptions to owned events and this view
    const subscriptions = [
      tree.view,
      vscode.window.onDidChangeActiveTextEditor(() => {
        if (!vscode.window.activeTextEditor) return;
        const project = workspace.getActiveProject();
        tree.currentProject = project;
      }),
      registerCommand(
        'stitch.spriteSource.watch',
        async (stage: SpriteSourceFolder) => {
          const wait = stage.watch();
          // Make sure the icon gets reset!
          tree._onDidChangeTreeData.fire(stage);
          await wait;
        },
      ),
      registerCommand(
        'stitch.spriteSource.unwatch',
        (stage: SpriteSourceFolder) => {
          stage.unwatch();
          tree._onDidChangeTreeData.fire(stage);
        },
      ),
      registerCommand(
        'stitch.spriteSource.addStage',
        (source: SpriteSourceFolder) => {
          tree.addSpriteSourceStage(source);
        },
      ),
      registerCommand(
        'stitch.spriteSource.clearRecentImports',
        (folder: RecentlyChangedFolder) => {
          SpriteSourcesTree.recentlyChangedSprites.delete(folder.project);
          tree.rebuild();
        },
      ),
      registerCommand(
        'stitch.spriteSource.clearCache',
        (source: SpriteSourceFolder | undefined) => {
          tree.clearCache(source);
        },
      ),
      registerCommand('stitch.spriteSource.create', () => {
        tree.addSpriteSource();
      }),
      registerCommand(
        'stitch.spriteSource.delete',
        (source: SpriteSourceFolder) => {
          tree.deleteSpriteSource(source);
        },
      ),
      registerCommand('stitch.spriteSource.edit', async () => {
        assertLoudly(tree.currentProject, 'No project active.');
        const dest = await SpriteDest.from(
          tree.currentProject.yypPath.absolute,
        );
        vscode.commands.executeCommand(
          'vscode.open',
          vscode.Uri.file(dest.configFile.absolute),
        );
      }),
      registerCommand(
        'stitch.spriteSource.openExplorer',
        (source: SpriteSourceFolder | SpriteSourceStageItem) => {
          const fileUri = vscode.Uri.file(source.sourceDir.absolute);
          vscode.env.openExternal(fileUri);
        },
      ),
      registerCommand('stitch.spriteSource.import', async () => {
        if (tree.importing) return;
        tree.importing = true;
        await tree.importSprites().finally(() => {
          tree.importing = false;
        });
      }),
    ];
    return subscriptions;
  }
}

class SpriteSourcesFolder extends StitchTreeItemBase<'sprite-sources'> {
  override readonly kind = 'sprite-sources';
  parent = undefined;
  constructor(readonly project: GameMakerProject) {
    super('Sprite Sources');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }

  async getChildren(): Promise<SpriteSourceFolder[]> {
    const dest = await SpriteDest.from(this.project.yypPath.absolute);
    const config = await dest.loadConfig();
    if (!config.sources?.length) return [];
    const children: SpriteSourceFolder[] = [];
    for (const source of config.sources) {
      try {
        children.push(
          await SpriteSourceFolder.from(this.project, source.source),
        );
      } catch (err) {
        logger.error(`Error loading sprite source: ${source.source}`, err);
      }
    }
    return children;
  }
}

class SpriteSourceFolder extends StitchTreeItemBase<'sprite-source'> {
  static sources = new Set<string>();
  override readonly kind = 'sprite-source';
  parent = undefined;
  readonly sourceDir: Pathy;
  invalid = false;

  static async from(project: GameMakerProject, relativeSourceDir: string) {
    const item = new SpriteSourceFolder(project, relativeSourceDir);
    // The source folder may not exist, and if not we want to be able to
    // show a warning icon. So figure that out before rendering in the tree.
    try {
      await SpriteSource.from(item.sourceDir.absolute);
    } catch {
      // Override the behavior
      item.invalid = true;
      item.command = undefined;
      item.description = `Not Found`;
      item.tooltip = `The folder "${item.sourceDir.absolute}" does not exist on this device.`;
      item.setBaseIcon('warning');
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;
      item.contextValue = item.kind;
    }
    return item;
  }

  protected constructor(
    readonly project: GameMakerProject,
    readonly relativeSourceDir: string,
  ) {
    const sourceDir = pathy(relativeSourceDir, project.dir);
    super(sourceDir.name);
    this.sourceDir = sourceDir;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

    // Add a command to open the config file
    this.command = {
      command: 'vscode.open',
      title: 'Open Sprite Source Config',
      arguments: [vscode.Uri.file(this.configPath.absolute)],
    };
    this.tooltip = `A folder containing folders-of-images (sprites sources) that can be imported into the game as sprites.`;

    // NOTE: Calling 'unwatch' here will cause the watcher to
    // turn itself off, since these instances are recreated every
    // time the tree is refreshed.
    // We need to set the contextValue based on what's currently being watch
    const isWatching = SpriteSourcesTree.sourceWatchers.has(
      this.sourceDir.absolute,
    );
    this.contextValue = `${this.kind}-${isWatching ? '' : 'un'}watched`;

    this.setBaseIcon('library');

    // Handle watch-on-startup
    if (
      stitchConfig.spriteAutoImportOnStartup &&
      !SpriteSourceFolder.sources.has(this.sourceDir.absolute)
    ) {
      this.watch();
    }
    SpriteSourceFolder.sources.add(this.sourceDir.absolute);
  }

  async getChildren(): Promise<SpriteSourceStageItem[]> {
    if (this.invalid) return [];

    const children: SpriteSourceStageItem[] = [];
    const src = await SpriteSource.from(this.sourceDir.absolute);
    const config = await src.loadConfig();
    for (const stage of config.staging || []) {
      try {
        children.push(new SpriteSourceStageItem(this, stage));
      } catch (err) {
        logger.error(`Error loading sprite source stage: ${stage.dir}`, err);
      }
    }
    return children;
  }

  get configPath() {
    return this.sourceDir.join('.stitch/sprites.source.json');
  }

  async watch() {
    this.unwatch();
    this.contextValue = `${this.kind}-watched`;

    // Do an initial import
    debounceImport();

    // Whenever a png file is added, removed, or changed, we
    // need to run the import
    const watchers = ['png', 'atlas', 'json'].map((ext) =>
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(this.sourceDir.absolute, `**/*.${ext}`),
      ),
    );

    // Watch the content of the staged folders
    const children = await this.getChildren();
    for (const child of children) {
      watchers.push(
        vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(child.sourceDir.absolute, `**/*.png`),
        ),
      );
    }

    for (const watcher of watchers) {
      for (const listener of ['onDidCreate', 'onDidChange'] as const) {
        watcher[listener]((uri: vscode.Uri) => {
          if (uri.fsPath.split(/[\\/]+/).includes('.stitch')) {
            return;
          }
          debounceImport();
        });
      }
    }

    SpriteSourcesTree.sourceWatchers.set(this.sourceDir.absolute, watchers);
  }

  unwatch() {
    this.contextValue = `${this.kind}-unwatched`;
    const watchers = SpriteSourcesTree.sourceWatchers.get(
      this.sourceDir.absolute,
    );
    watchers?.forEach((watcher) => watcher.dispose());
    SpriteSourcesTree.sourceWatchers.delete(this.sourceDir.absolute);
  }
}

class SpriteSourceStageItem extends StitchTreeItemBase<'sprite-source-stage'> {
  override readonly kind = 'sprite-source-stage';
  parent = undefined;
  constructor(
    readonly source: SpriteSourceFolder,
    readonly stage: SpriteSourceStage,
  ) {
    super(path.basename(stage.dir));
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    this.tooltip = `A folder of images that will be transformed and moved into the parent SpriteSource folder prior to an import operation.`;
    this.setBaseIcon('inbox');
  }

  get sourceDir() {
    return pathy(this.stage.dir, this.source.sourceDir);
  }
}

class RecentlyChangedFolder extends StitchTreeItemBase<'sprites'> {
  override readonly kind = 'sprites';
  parent = undefined;
  constructor(readonly project: GameMakerProject) {
    super('Recently Imported');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    this.setBaseIcon('history');
  }

  getChildren(): SpriteItem[] {
    const changes = SpriteSourcesTree.recentlyChangedSprites.get(this.project);
    if (!changes?.size) return [];
    const changedSprites = [...changes.entries()]
      .map(([name, info]) => {
        const asset = this.project.getAssetByName(name);
        if (!isAssetOfKind(asset, 'sprites')) return;
        return new SpriteItem(asset, info);
      })
      .filter((s): s is SpriteItem => !!s);
    changedSprites.sort((a, b) => {
      if (stitchConfig.sortSpriteSourceChangesBy === 'name') {
        return sortAlphaInsensitive(a.asset.name, b.asset.name);
      }
      // Otherwise sort by most recently changed first. If the times are within a short range of each other, sort by name.
      const timeDiff = b.info.when.getTime() - a.info.when.getTime();
      if (Math.abs(timeDiff) < 60_000) {
        return sortAlphaInsensitive(a.asset.name, b.asset.name);
      }
      return timeDiff;
    });
    return changedSprites;
  }
}

class SpriteItem extends ObjectSpriteItem {
  constructor(
    asset: Asset<'sprites'>,
    readonly info: SpriteChangeInfo,
  ) {
    super(asset);
    this.updateTimeStamp();
  }

  updateTimeStamp() {
    // const formatter = new Intl.DateTimeFormat();
    // formatter.
    // this.description = Intl.DateTimeFormat(this.info.when.toLocaleString();
    const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
      style: 'narrow',
      numeric: 'always',
    });
    const minutesAgo = Math.round(
      (new Date().getTime() - this.info.when.getTime()) / 1000 / 60,
    );
    this.description = relativeTimeFormatter.format(-minutesAgo, 'minutes');
    this.setIcon();
  }
}

let timeoutId: NodeJS.Timeout | null = null;

function debounceImport() {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(() => {
    // Call the import command
    vscode.commands.executeCommand('stitch.spriteSource.import');
  }, stitchConfig.spriteAutoImportDelay);
}
