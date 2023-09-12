import { Asset, isAssetOfKind } from '@bscotch/gml-parser';
import { Pathy, pathy } from '@bscotch/pathy';
import { SpriteDest, SpriteSource } from '@bscotch/sprite-source';
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

type Item = SpriteSourceFolder | SpriteSourceItem | SpriteFolder | SpriteItem;

export interface SpriteSourceConfig {
  targetProject?: string;
  name?: string;
  prefix?: string;
  postfix?: string;
  case?: 'keep' | 'snake' | 'camel' | 'pascal';
  flatten?: boolean;
  exclude?: string;
}

interface SpriteChangeInfo {
  when: Date;
}

export class SpriteSourcesTree implements vscode.TreeDataProvider<Item> {
  view!: vscode.TreeView<Item>;
  currentProject?: GameMakerProject;

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
  }

  async importSprites() {
    assertLoudly(this.currentProject, 'No active project.');

    const dest = await SpriteDest.from(this.currentProject.yypPath.absolute);

    // Prep the tracker for this project
    SpriteSourcesTree.recentlyChangedSprites.set(
      this.currentProject,
      SpriteSourcesTree.recentlyChangedSprites.get(this.currentProject) ||
        new Map(),
    );
    const projectChanges = SpriteSourcesTree.recentlyChangedSprites.get(
      this.currentProject,
    )!;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Importing sprites`,
        cancellable: false,
      },
      async (progress) => {
        const actions = await dest.import(undefined, progress);

        // Summarize all isues into a single popup
        const totalIssues = dest.issues.length;
        if (totalIssues) {
          const displayIssues = dest.issues.slice(0, 5);
          const moreIssues = totalIssues - displayIssues.length;
          logger.error(dest.issues);
          showErrorMessage(
            `There were ${totalIssues} issues importing sprites:\n\n${displayIssues
              .map((issue) => `- ${issue.message}`)
              .join('\n')}${moreIssues ? `\n\n...and ${moreIssues} more` : ''}`,
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

  async deleteSpriteSource(source: SpriteSourceItem) {
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

  async clearCache(source: SpriteSourceItem | undefined) {
    if (!source) {
      assertLoudly(this.currentProject, 'No active project.');
      // Then clear the destination cache for the current project
      const dest = await SpriteDest.from(this.currentProject.yypPath.absolute);
      await dest.cacheFile.delete();
    } else {
      // Then clear the cache for the given source
      const sourceDir = await SpriteSource.from(source.sourceDir.absolute);
      await sourceDir.cacheFile.delete();
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

  async getChildren(element?: Item): Promise<Item[]> {
    if (!element) {
      const project = this.workspace.getActiveProject();
      if (!project) {
        logger.info("No active project. Can't load sprite sources.");
        return [];
      }
      return [new SpriteSourceFolder(project), new SpriteFolder(project)];
    } else if (
      'getChildren' in element &&
      typeof element.getChildren === 'function'
    ) {
      return (await element.getChildren()) as Item[];
    }
    return [];
  }

  getTreeItem(element: SpriteSourceItem): SpriteSourceItem {
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
      // showCollapseAll: true,
    });
    tree.currentProject = workspace.getActiveProject();
    tree.rebuild();
    // Rebuild the tree with some frequency to update the timestamps
    setInterval(() => tree.rebuild(), 1000 * 60 * 1);

    // Return subscriptions to owned events and this view
    const subscriptions = [
      tree.view,
      vscode.window.onDidChangeActiveTextEditor(() => {
        if (!vscode.window.activeTextEditor) return;
        const project = workspace.getActiveProject();
        if (project === tree.currentProject) return;
        tree.currentProject = project;
        tree.rebuild();
      }),
      registerCommand(
        'stitch.spriteSource.clearCache',
        (source: SpriteSourceItem | undefined) => {
          tree.clearCache(source);
        },
      ),
      registerCommand('stitch.spriteSource.create', () => {
        tree.addSpriteSource();
      }),
      registerCommand(
        'stitch.spriteSource.delete',
        (source: SpriteSourceItem) => {
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
        (source: SpriteSourceItem) => {
          const fileUri = vscode.Uri.file(source.sourceDir.absolute);
          vscode.env.openExternal(fileUri);
        },
      ),
      registerCommand('stitch.spriteSource.import', () => {
        tree.importSprites();
      }),
    ];
    return subscriptions;
  }
}

class SpriteSourceFolder extends StitchTreeItemBase<'sprite-sources'> {
  override readonly kind = 'sprite-sources';
  parent = undefined;
  constructor(readonly project: GameMakerProject) {
    super('Sprite Sources');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }

  async getChildren(): Promise<SpriteSourceItem[]> {
    const dest = await SpriteDest.from(this.project.yypPath.absolute);
    const config = await dest.loadConfig();
    if (!config.sources?.length) return [];
    return config.sources.map((source) => {
      return new SpriteSourceItem(this.project, source.source);
    });
  }
}

class SpriteSourceItem extends StitchTreeItemBase<'sprite-source'> {
  override readonly kind = 'sprite-source';
  parent = undefined;
  readonly sourceDir: Pathy;
  constructor(
    readonly project: GameMakerProject,
    readonly relativeSourceDir: string,
  ) {
    const sourceDir = pathy(relativeSourceDir, project.dir);
    super(sourceDir.name);
    this.sourceDir = sourceDir;
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;

    // Add a command to open the config file
    this.command = {
      command: 'vscode.open',
      title: 'Open Sprite Source Config',
      arguments: [vscode.Uri.file(this.configPath.absolute)],
    };
  }

  get configPath() {
    return this.sourceDir.join('.stitch/sprites.source.json');
  }
}

class SpriteFolder extends StitchTreeItemBase<'sprites'> {
  override readonly kind = 'sprites';
  parent = undefined;
  constructor(readonly project: GameMakerProject) {
    super('Recently Imported');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
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
      if (Math.abs(timeDiff) < 10_000) {
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
  }
}
