import { Asset, isAssetOfKind } from '@bscotch/gml-parser';
import { Pathy, pathy } from '@bscotch/pathy';
import { StitchProject } from '@bscotch/stitch';
import vscode from 'vscode';
import { assertInternalClaim, assertLoudly } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import { stitchEvents } from './events.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { ObjectSpriteItem } from './inspector.mjs';
import { registerCommand, sortAlphaInsensitive } from './lib.mjs';
import { showErrorMessage } from './log.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';

type Item = SpriteSourceItem | SpriteItem;

export interface SpriteSourceConfig {
  targetProject?: string;
  name?: string;
  prefix?: string;
  postfix?: string;
  case?: 'keep' | 'snake' | 'camel' | 'pascal';
  flatten?: boolean;
  exclude?: string;
}

interface ConfigInfo {
  path: Pathy<SpriteSourceConfig>;
  config?: SpriteSourceConfig;
  error?: Error;
}

interface SpriteChangeInfo {
  when: Date;
  project: GameMakerProject;
}

export class SpriteSourcesTree implements vscode.TreeDataProvider<Item> {
  view!: vscode.TreeView<Item>;
  sources: Pathy<SpriteSourceConfig>[] = [];
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
    assertInternalClaim(
      source && source instanceof SpriteSourceItem,
      'Expected a SpriteSourceItem',
    );
    // Get the target project. The project is stored as a path relative to
    // the sprite source folder.
    const targetProjectRelative = source.info.config?.targetProject;
    assertLoudly(
      targetProjectRelative,
      'No target project specified in sprite source config.',
    );
    const targetProjectPath = pathy(
      targetProjectRelative,
      source.info.path.up(),
    );
    const targetProject = this.workspace.projects.find((p) =>
      p.yypPath.equals(targetProjectPath),
    );
    assertLoudly(
      targetProject,
      `Could not find target project in the current workspace.`,
    );
    return targetProject;
  }

  async importSprites(source: SpriteSourceItem) {
    const targetProject = this.getProjectFromSource(source);
    const changedSprites = SpriteSourcesTree.recentlyChangedSprites
      .set(
        source.info.path.absolute,
        SpriteSourcesTree.recentlyChangedSprites.get(
          source.info.path.absolute,
        ) || new Map(),
      )
      .get(source.info.path.absolute)!;

    // Create a progress bar to show the import progress,
    // in the bscotch-stitch-sprite-sources tree view.
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Importing sprites...`,
        cancellable: false,
      },
      async (progress) => {
        // Run the Stitch batch-import command, attaching plugins to add to
        // the cumulative list of changed sprites.\
        try {
          progress.report({ increment: 0 });
          let totalSprites = 0;
          const model = await StitchProject.load({
            dangerouslyAllowDirtyWorkingDir: true,
            projectPath: targetProject.yypPath.absolute,
            plugins: [
              {
                beforeSpritesAdded(_project, info) {
                  totalSprites = info.spriteSources.length;
                },
                afterSpriteAdded: (project, info) => {
                  // Update the progress bar
                  progress.report({
                    increment: 100 / totalSprites,
                  });
                  // Update the cumulative list of changed sprites
                  changedSprites.set(info.sprite.name, {
                    when: new Date(),
                    project: targetProject,
                  });
                },
              },
            ],
          });
          await model.addSprites(source.info.path.up().absolute, {
            case: source.info.config?.case,
            exclude: source.info.config?.exclude,
            flatten: source.info.config?.flatten,
            postfix: source.info.config?.postfix,
            prefix: source.info.config?.prefix,
          });
        } catch (err) {
          showErrorMessage(err as Error);
        }
      },
    );
    // Rebuild the tree
    this.rebuild();
  }

  async loadConfigs() {
    const normalizedName = (info: ConfigInfo) =>
      (info.config?.name || info.path.up().name).toLocaleLowerCase();
    const configWaits: Promise<ConfigInfo>[] = [];
    for (const source of this.sources) {
      configWaits.push(
        source
          .read<SpriteSourceConfig, SpriteSourceConfig>()
          .then((config) => ({ path: source, config }))
          .catch(() => ({
            path: source,
            error: new Error('Could not find config file.'),
          })),
      );
    }
    const configs = (await Promise.all(configWaits)).sort((a, b) =>
      normalizedName(a).localeCompare(normalizedName(b)),
    );
    return configs;
  }

  deleteSpriteSource(source: SpriteSourceItem) {
    const sourcesFromSettings = stitchConfig.spriteSources;
    const sourceIndex = sourcesFromSettings.findIndex((p) =>
      source.info.path.equals(p),
    );
    assertLoudly(sourceIndex >= 0, 'Could not find sprite source in settings.');
    sourcesFromSettings.splice(sourceIndex, 1);
    stitchConfig.spriteSources = sourcesFromSettings;
    this.sources = sourcesFromSettings.map((s) => pathy(s));
    // Rebuild the tree
    this.rebuild();
  }

  async addSpriteSource() {
    // Have the user choose a folder
    const rawSource = (
      await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: false,
        filters: { 'Sprite Source Config': ['json'] },
        openLabel: 'Add Source',
        title: 'Choose a Sprite Source folder',
      })
    )?.[0];
    if (!rawSource) return;

    const sourceFolder = pathy(rawSource.fsPath);
    await sourceFolder.exists({ assert: true });
    await sourceFolder.isDirectory({ assert: true });
    const sourceFile: Pathy<SpriteSourceConfig> = sourceFolder.join(
      'stitch.sprites.json',
    );

    // Load the file (if it exists). Populate missing config values
    // with defaults or user input.
    const sourceConfig = await sourceFile.read<
      SpriteSourceConfig,
      SpriteSourceConfig
    >({
      fallback: {} as SpriteSourceConfig,
    });
    // Ensure a human-friendly name
    if (!sourceConfig.name) {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter a human-friendly name for this Sprite Source',
        value: sourceFolder.name,
      });
      if (!name) return;
      sourceConfig.name = name;
    }
    // Ensure the target project
    if (!sourceConfig.targetProject) {
      assertLoudly(
        this.workspace.projects.length > 0,
        'No projects loaded. Cannot create a sprite source without a target project.',
      );
      const targetProjectName =
        this.workspace.projects.length === 1
          ? this.workspace.projects[0].name
          : await vscode.window.showQuickPick(
              this.workspace.projects.map((p) => p.name),
            );
      if (!targetProjectName) return;
      const targetProject = this.workspace.projects.find(
        (p) => p.name === targetProjectName,
      )!;
      sourceConfig.targetProject = sourceFolder.relativeTo(
        targetProject.yypPath,
      );
    }
    // Save the config
    await sourceFile.write(sourceConfig);
    this.sources.push(sourceFile);
    // Add to the settings
    const sourcesFromSettings = stitchConfig.spriteSources;
    stitchConfig.spriteSources = [...sourcesFromSettings, sourceFile.absolute];

    // Rebuild the tree
    this.rebuild();
  }

  async getChildren(element?: Item): Promise<Item[]> {
    if (!element) {
      const configs = await this.loadConfigs();
      return configs.map((info) => new SpriteSourceItem(info));
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
    tree.sources = stitchConfig.spriteSources.map((s) => pathy(s));
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
          const fileUri = vscode.Uri.file(source.info.path.up().absolute);
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

class SpriteSourceItem extends StitchTreeItemBase<'sprite-source'> {
  override readonly kind = 'sprite-source';
  parent = undefined;
  constructor(readonly info: ConfigInfo) {
    super(info.config?.name || info.path.up().name);
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    if (info.error) {
      this.tooltip = info.error.message;
      this.setBaseIcon('warning');
      // Add a command to open the corresponding VSCode setting
      this.command = {
        command: 'workbench.action.openSettings',
        title: 'Open Stitch Sprite Sources Settings',
        arguments: ['stitch.sprites.sources'],
      };
    } else {
      this.setBaseIcon('folder');
      // Add a command to open the config file
      this.command = {
        command: 'vscode.open',
        title: 'Open Sprite Source Config',
        arguments: [vscode.Uri.file(info.path.absolute)],
      };
    }
  }

  getChildren(): SpriteItem[] {
    const changes = SpriteSourcesTree.recentlyChangedSprites.get(
      this.info.path.absolute,
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
