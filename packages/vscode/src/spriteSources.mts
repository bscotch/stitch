import { Pathy, pathy } from '@bscotch/pathy';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { registerCommand } from './lib.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';

type Item = SpriteSourceItem;

export interface SpriteSourceConfig {
  targetProject?: string;
  name?: string;
}

interface ConfigInfo {
  path: Pathy<SpriteSourceConfig>;
  config?: SpriteSourceConfig;
  error?: Error;
}

export class SpriteSourcesTree implements vscode.TreeDataProvider<Item> {
  view!: vscode.TreeView<Item>;
  sources: Pathy<SpriteSourceConfig>[] = [];

  private _onDidChangeTreeData: vscode.EventEmitter<
    Item | undefined | null | void
  > = new vscode.EventEmitter<Item | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidCollapseElement: vscode.EventEmitter<
    Item | undefined | null | void
  > = new vscode.EventEmitter<Item | undefined | null | void>();
  readonly onDidCollapseElement = this._onDidCollapseElement.event;

  constructor(readonly workspace: StitchWorkspace) {}

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

  async getChildren(element?: SpriteSourceItem): Promise<SpriteSourceItem[]> {
    if (!element) {
      const configs = await this.loadConfigs();
      return configs.map((info) => new SpriteSourceItem(info));
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
}
