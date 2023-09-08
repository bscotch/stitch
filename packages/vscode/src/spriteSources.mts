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
import {
  getAbsoluteWorkspacePath,
  getRelativeWorkspacePath,
  registerCommand,
  sortAlphaInsensitive,
} from './lib.mjs';
import { logger, showErrorMessage } from './log.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';

type Item = SpriteSourceItem | SpriteSourceItemInvalid | SpriteItem;

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
  project: GameMakerProject;
}

export class SpriteSourcesTree implements vscode.TreeDataProvider<Item> {
  view!: vscode.TreeView<Item>;
  // Map of <sourcePath: spriteName: SpriteChangeInfo>
  static recentlyChangedSprites: Map<string, Map<string, SpriteChangeInfo>> =
    new Map();

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

  protected getProjectFromSource(source: SpriteSourceItem) {
    return source.project;
  }

  async importSprites(source: SpriteSourceItem) {
    assertLoudly(source.project, 'No project found for sprite source.');

    const dest = await SpriteDest.from(source.project.yypPath.absolute);
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Importing sprites...`,
        cancellable: false,
      },
      async (progress) => {
        const actions = await dest.import(undefined, progress);

        // Summarize all isues into a single popup
        const totalIssues = dest.issues.length;
        if (totalIssues) {
          const displayIssues = dest.issues.slice(0, 5);
          const moreIssues = totalIssues - displayIssues.length;
          showErrorMessage(
            `There were ${totalIssues} issues importing sprites:\n\n${displayIssues
              .map((issue) => `- ${issue.message}`)
              .join('\n')}${moreIssues ? `\n\n...and ${moreIssues} more` : ''}`,
          );
        }

        // Add the changes to the recently changed list
        const changedSprites = SpriteSourcesTree.recentlyChangedSprites
          .set(
            source.source.spritesRoot.absolute,
            SpriteSourcesTree.recentlyChangedSprites.get(
              source.source.spritesRoot.absolute,
            ) || new Map(),
          )
          .get(source.source.spritesRoot.absolute)!;
        for (const action of actions || []) {
          changedSprites.set(action.resource.name, {
            when: new Date(),
            project: source.project,
          });
        }
      },
    );

    this.rebuild();
  }

  async loadProjectSources(
    project: GameMakerProject,
  ): Promise<(SpriteSourceItem | SpriteSourceItemInvalid)[]> {
    const allSources = stitchConfig.spriteSources;
    const relativeProjectPath = getRelativeWorkspacePath(
      project.yypPath.absolute,
    );
    const sourcePaths = allSources[relativeProjectPath].map((p) =>
      getAbsoluteWorkspacePath(p),
    );
    if (!sourcePaths?.length) return [];
    const results = await Promise.allSettled(
      sourcePaths.map((p) => SpriteSource.from(p)),
    );
    return results.map((r, i) => {
      if (r.status === 'rejected') {
        return new SpriteSourceItemInvalid(project, pathy(sourcePaths[i]));
      }
      return new SpriteSourceItem(project, r.value);
    });
  }

  deleteSpriteSource(source: SpriteSourceItem) {
    const allSources = stitchConfig.spriteSources;
    const relativeProjectPath = getRelativeWorkspacePath(
      source.project.yypPath.absolute,
    );
    const sourcesFromSettings = allSources[relativeProjectPath];
    const sourceIndex = sourcesFromSettings.findIndex((p) =>
      source.source.spritesRoot.equals(getAbsoluteWorkspacePath(p)),
    );
    assertLoudly(sourceIndex >= 0, 'Could not find sprite source in settings.');
    sourcesFromSettings.splice(sourceIndex, 1);
    allSources[relativeProjectPath] = [...sourcesFromSettings];
    stitchConfig.spriteSources = allSources;
    // Note: The tree will be rebuilt when the config change is detected
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

    const sources = { ...stitchConfig.spriteSources };
    const key = getRelativeWorkspacePath(targetProject.yypPath.absolute);
    sources[key] ||= [];
    sources[key] = [
      ...sources[key],
      getRelativeWorkspacePath(source.spritesRoot.absolute),
    ];
    stitchConfig.spriteSources = sources;
    // Note: The tree will be rebuilt when the config change is detected
  }

  async getChildren(element?: Item): Promise<Item[]> {
    if (!element) {
      const project = this.workspace.getActiveProject();
      if (!project) {
        logger.info("No active project. Can't load sprite sources.");
        return [];
      }
      return await this.loadProjectSources(project);
    } else if (
      'getChildren' in element &&
      typeof element.getChildren === 'function'
    ) {
      return element.getChildren() as Item[];
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
    tree.rebuild();
    // Rebuild the tree with some frequency to update the timestamps
    setInterval(() => tree.rebuild(), 1000 * 60 * 1);

    // Return subscriptions to owned events and this view
    const subscriptions = [
      tree.view,
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('stitch.sprites.sources')) {
          // Rebuild the tree!
          tree.rebuild();
        }
      }),
      registerCommand('stitch.spriteSource.create', () => {
        tree.addSpriteSource();
      }),
      registerCommand(
        'stitch.spriteSource.delete',
        (source: SpriteSourceItem) => {
          tree.deleteSpriteSource(source);
        },
      ),
      registerCommand(
        'stitch.spriteSource.openExplorer',
        (source: SpriteSourceItem) => {
          const fileUri = vscode.Uri.file(source.source.spritesRoot.absolute);
          vscode.env.openExternal(fileUri);
        },
      ),
      registerCommand(
        'stitch.spriteSource.import',
        (source: SpriteSourceItem) => {
          tree.importSprites(source);
        },
      ),
    ];
    return subscriptions;
  }
}

class SpriteSourceItemInvalid extends StitchTreeItemBase<'sprite-source-invalid'> {
  override readonly kind = 'sprite-source-invalid';
  parent = undefined;
  constructor(
    readonly project: GameMakerProject,
    readonly spriteSourcePath: Pathy,
  ) {
    super(spriteSourcePath.name);
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    this.setBaseIcon('warning');
    // Add a command to open the corresponding VSCode setting
    this.command = {
      command: 'workbench.action.openSettings',
      title: 'Open Stitch Sprite Sources Settings',
      arguments: ['stitch.sprites.sources'],
    };
  }
}

class SpriteSourceItem extends StitchTreeItemBase<'sprite-source'> {
  override readonly kind = 'sprite-source';
  parent = undefined;
  constructor(
    readonly project: GameMakerProject,
    readonly source: SpriteSource,
  ) {
    super(source.spritesRoot.name);
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

    this.setBaseIcon('folder');
    // Add a command to open the config file
    this.command = {
      command: 'vscode.open',
      title: 'Open Sprite Source Config',
      arguments: [vscode.Uri.file(source.configFile.absolute)],
    };
  }

  getChildren(): SpriteItem[] {
    const changes = SpriteSourcesTree.recentlyChangedSprites.get(
      this.source.spritesRoot.absolute,
    );
    if (!changes) return [];
    const changedSprites = [...changes.entries()]
      .map(([name, info]) => {
        const asset = info.project.getAssetByName(name);
        if (!isAssetOfKind(asset, 'sprites')) return;
        return new SpriteItem(asset, info);
      })
      .filter((s): s is SpriteItem => !!s);
    // Sort alphabetically
    changedSprites.sort((a, b) =>
      sortAlphaInsensitive(a.asset.name, b.asset.name),
    );
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
