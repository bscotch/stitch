import {
  GameMakerProject,
  getEventFromFilename,
  ImportError,
  importAssets,
  objectEvents,
  type Asset,
  type ImportOptions,
  type ObjectEvent,
} from '@bscotch/gamemaker-project';
import { analyzeProject, listCodeDependencies } from '@bscotch/gml-analysis';
import { globalNamesRequest } from '@bscotch/gml-language-server/protocol';
import { pathy } from '@bscotch/pathy';
import { applySpriteAction, SpriteDir } from '@bscotch/sprite-source';
import { isValidSpriteName } from '@bscotch/stitch-config';
import fs from 'node:fs/promises';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import { stitchEvents } from './events.mjs';
import type { StitchProject } from './extension.project.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { getAssetIcon, getBaseIcon } from './icons.mjs';
import type { ObjectParentFolder, ObjectSpriteFolder } from './inspector.mjs';
import { pathyFromUri, registerCommand, showProgress } from './lib.mjs';
import { logger, showErrorMessage } from './log.mjs';
import { handleDrag, handleDrop } from './tree.dragDrop.mjs';
import {
  GameMakerFolder,
  GameMakerProjectFolder,
  GameMakerRootFolder,
} from './tree.folder.mjs';
import {
  TreeAsset,
  TreeCode,
  TreeFilter,
  TreeFilterGroup,
  TreeRoomInstance,
  TreeShaderFile,
  TreeSpriteFrame,
  type Treeable,
} from './tree.items.mjs';
import {
  getPathWithSelection,
  promptForAssetName,
  promptForAssetPath,
  validateFolderName,
} from './tree.utility.mjs';

/** Join asset-tree path parts, skipping empty ones */
function joinTreePath(...parts: string[]): string {
  return parts.filter(Boolean).join('/');
}

export class GameMakerTreeProvider
  implements
    vscode.TreeDataProvider<Treeable>,
    vscode.TreeDragAndDropController<Treeable>
{
  tree = new GameMakerRootFolder();
  view!: vscode.TreeView<Treeable>;
  readonly treeMimeType = 'application/vnd.code.tree.bscotch-stitch-resources';
  readonly dragMimeTypes = [this.treeMimeType];
  readonly dropMimeTypes = [this.treeMimeType, 'text/uri-list'];

  private _onDidChangeTreeData: vscode.EventEmitter<
    Treeable | undefined | null | void
  > = new vscode.EventEmitter<Treeable | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidCollapseElement: vscode.EventEmitter<
    Treeable | undefined | null | void
  > = new vscode.EventEmitter<Treeable | undefined | null | void>();
  readonly onDidCollapseElement = this._onDidCollapseElement.event;

  constructor(readonly workspace: StitchWorkspace) {
    // The tree follows the project: every change (made here, by GameMaker,
    // by git, ...) arrives as an event.
    stitchEvents.on('asset-changed', (asset) => {
      const item = TreeAsset.lookup.get(asset);
      if (item) {
        item.refreshTreeItem();
        this.changed(item);
      }
    });
    stitchEvents.on('project-changed', () => {
      this.rebuild();
    });
  }

  get projects(): StitchProject[] {
    return this.workspace.projects;
  }

  async handleDrop(
    target: Treeable | undefined,
    dataTransfer: vscode.DataTransfer,
  ) {
    try {
      return await handleDrop(this, target, dataTransfer);
    } catch (err) {
      void showErrorMessage(err as Error);
    }
  }

  handleDrag(source: readonly Treeable[], dataTransfer: vscode.DataTransfer) {
    handleDrag(this, source, dataTransfer);
  }

  changed(item?: Treeable) {
    this._onDidChangeTreeData.fire(item);
  }

  /**
   * Reveal an associated tree item in the sidebar.
   * For folders, the value must be the folder's path string
   * with `/` separators.
   */
  reveal(item: string | Asset | undefined) {
    item ||= this.workspace.getCurrentAsset();
    if (!item) {
      return;
    }
    const treeItem =
      typeof item === 'string'
        ? GameMakerFolder.lookup.get(item)
        : TreeAsset.lookup.get(item);
    if (!treeItem) {
      return;
    }
    void this.view.reveal(treeItem, {
      focus: true,
      expand: true,
      select: true,
    });
  }

  /** Import assets from another project */
  protected async importAssets() {
    const acceptsRisk = await vscode.window.showWarningMessage(
      'This is an experimental feature. It may not work as expected, and may cause data loss. Do you want to continue?',
      { modal: true },
      'Yes',
    );
    if (acceptsRisk !== 'Yes') return;

    const targetProject = await this.workspace.chooseProject(
      'Choose the target project',
    );
    if (!targetProject) return;

    // Get the source project from the file system
    const sourceProjectPath = (
      await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'GameMaker Project': ['yyp'] },
        openLabel: 'Use as Source',
        title: 'Choose a source project to import from',
      })
    )?.[0];
    if (!sourceProjectPath) return;
    const { source, dependencies } = await showProgress(async () => {
      const source = await GameMakerProject.open(sourceProjectPath.fsPath);
      // Code dependencies, so that what the imported code needs comes along
      const analyzer = await analyzeProject(source);
      return { source, dependencies: listCodeDependencies(source, analyzer) };
    }, 'Loading source project...');

    // Get the desired assets to import
    const choices: vscode.QuickPickItem[] = [];
    for (const folder of source.folders) {
      choices.push({
        label: folder,
        description: 'folder',
        iconPath: getBaseIcon('folder'),
      });
    }
    for (const asset of source.assets) {
      choices.push({
        label: asset.name,
        description: asset.kind,
        iconPath: getAssetIcon(asset.kind, asset),
      });
    }

    const choice = await vscode.window.showQuickPick(choices, {
      title: 'Choose an asset or folder to import',
    });
    if (!choice) return;

    const missingDepOpts = ['error', 'skip', 'include'] as const;
    const onMissingDependency = (
      await vscode.window.showQuickPick(
        missingDepOpts.map((o) => ({ label: o })),
        { title: 'What to do if a dependency is missing?' },
      )
    )?.label;
    if (!onMissingDependency) return;

    // Symbols the target project already defines satisfy code dependencies
    const targetGlobals = new Set<string>(
      (await targetProject.client
        ?.sendRequest<string[]>(globalNamesRequest)
        .catch(() => [])) ?? [],
    );
    const options: ImportOptions = {
      sourceAsset: choice.description === 'folder' ? undefined : choice.label,
      sourceFolder: choice.description === 'folder' ? choice.label : undefined,
      onMissingDependency,
      dependencies,
      targetHasSymbol: (name) => targetGlobals.has(name),
    };

    try {
      const result = await showProgress(
        () => importAssets(source, targetProject.gm, options),
        'Importing...',
      );
      void vscode.window.showInformationMessage(
        `Imported ${result.created.length} new and ${result.replaced.length} replaced assets.` +
          (result.missing.length
            ? ` Skipped ${result.missing.length} missing dependencies.`
            : ''),
      );
    } catch (err) {
      if (err instanceof ImportError) {
        logger.error('Import failed', err.conflicts, err.missing);
      }
      void showErrorMessage(err as Error);
    }
  }

  /**
   * Prompt the user for a new asset name (optionally with subfolders),
   * returning its full asset-tree path.
   */
  protected async prepareForNewAsset(
    where: GameMakerFolder,
    initialName?: string,
  ) {
    const newAssetName = await promptForAssetPath(initialName);
    if (!newAssetName) {
      return;
    }
    const parts = newAssetName.split('/');
    const name = parts.pop()!;
    if (where.project!.getAssetByName(name)) {
      void showErrorMessage(`An asset named ${name} already exists.`);
      return;
    }
    return { path: joinTreePath(where.path, ...parts, name), name };
  }

  /** Show a newly created asset in the tree */
  afterNewAssetCreated(asset: Asset | undefined) {
    if (!asset) {
      void showErrorMessage(`Failed to create new asset.`);
      return;
    }
    this.rebuild();
    const treeItem = TreeAsset.lookup.get(asset);
    if (treeItem) void this.view.reveal(treeItem, { focus: true });
  }

  /** Run a change, showing any error instead of throwing */
  protected async attempt<T>(change: () => Promise<T>): Promise<T | undefined> {
    try {
      return await change();
    } catch (err) {
      logger.error(err);
      void showErrorMessage(err as Error);
      return undefined;
    }
  }

  async deleteRoomInstance(item: TreeRoomInstance) {
    await this.attempt(() =>
      item.project!.gm.removeRoomInstance(item.parent.asset, item.instanceId),
    );
  }

  async addRoomInstance(roomItem: TreeAsset<'rooms'>) {
    const project = roomItem.project!;
    const objectChoice = await vscode.window.showQuickPick(
      project.gm.listAssets('objects').map((object) => ({
        label: object.name,
        object,
      })),
      { title: 'Choose the object to add to the room' },
    );
    if (!objectChoice) return;
    await this.attempt(() =>
      project.gm.addRoomInstance(roomItem.asset, objectChoice.object),
    );
  }

  async setSprite(
    objectItem: ObjectParentFolder | ObjectSpriteFolder | TreeAsset,
  ) {
    const asset = objectItem.asset;
    const project = this.workspace.getProjectOfAsset(asset);
    if (!asset.isKind('objects') || !project) return;
    const spriteOptions = project.gm
      .listAssets('sprites')
      .map((p) => ({
        label: p.name,
        sprite: p as Asset<'sprites'> | undefined,
        description: undefined as string | undefined,
      }))
      .sort((a, b) =>
        a.label.toLocaleLowerCase().localeCompare(b.label.toLocaleLowerCase()),
      );
    if (asset.spriteName) {
      spriteOptions.unshift({
        label: 'Sprites',
        // @ts-expect-error -- Separators aren't part of the options' inferred type
        kind: vscode.QuickPickItemKind.Separator,
      });
      spriteOptions.unshift({
        label: 'None',
        description: 'Unassign the current sprite',
        sprite: undefined,
      });
    }
    const spriteChoice = await vscode.window.showQuickPick(spriteOptions, {
      title: 'Select the sprite to assign to this object',
    });
    if (!spriteChoice || (!spriteChoice.sprite && !asset.spriteName)) {
      return;
    }
    logger.info('Setting sprite', spriteChoice.label);
    await this.attempt(() =>
      project.gm.setObjectSprite(asset, spriteChoice.sprite),
    );
  }

  /** The asset to act on: a tree item's, the given one, or the one at the cursor */
  protected async resolveAsset(
    entity: TreeAsset | Asset | { asset: Asset } | undefined,
  ): Promise<Asset | undefined> {
    if (!entity) return await this.workspace.getAssetAtCursor();
    return 'asset' in entity ? entity.asset : entity;
  }

  async editSound(entity: TreeAsset | Asset | undefined) {
    const asset = await this.resolveAsset(entity);
    if (!asset?.isKind('sounds') || !asset.soundFile) return;
    await vscode.commands.executeCommand(
      'vscode.open',
      vscode.Uri.file(asset.soundFile),
    );
  }

  async editSprite(entity: TreeAsset | Asset | undefined) {
    const asset = await this.resolveAsset(entity);
    if (!asset?.isKind('sprites')) return;
    stitchEvents.emit('sprite-editor-open', asset);
  }

  async setParent(objectItem: ObjectParentFolder | TreeAsset) {
    const asset = objectItem.asset;
    const project = this.workspace.getProjectOfAsset(asset);
    if (!asset.isKind('objects') || !project) return;
    // (No circular inheritance)
    const parentOptions = project.gm
      .listAssets('objects')
      .filter(
        (candidate) =>
          candidate !== asset &&
          !project.gm.getAncestors(candidate).includes(asset),
      )
      .map((p) => ({
        label: p.name,
        asset: p as Asset<'objects'> | undefined,
        description: undefined as string | undefined,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (asset.parentName) {
      parentOptions.unshift({
        label: 'Objects',
        // @ts-expect-error -- Separators aren't part of the options' inferred type
        kind: vscode.QuickPickItemKind.Separator,
      });
      parentOptions.unshift({
        label: 'None',
        description: 'Remove the parent object',
        asset: undefined,
      });
    }
    const parentChoice = await vscode.window.showQuickPick(parentOptions, {
      title: 'Select the parent object',
    });
    if (!parentChoice || (!parentChoice.asset && !asset.parentName)) {
      return;
    }
    logger.info('Setting parent', parentChoice.label);
    await this.attempt(() =>
      project.gm.setObjectParent(asset, parentChoice.asset),
    );
  }

  async createRoom(where: GameMakerFolder) {
    const info = await this.prepareForNewAsset(where);
    if (!info) return;
    this.afterNewAssetCreated(
      await this.attempt(() => where.project!.gm.createRoom(info.path)),
    );
  }

  /**
   * Add an event to an object. Includes collision events, for which the
   * other object is chosen next.
   */
  async createEvent(objectItem: TreeAsset | { asset: Asset }) {
    const asset = objectItem.asset;
    const project = this.workspace.getProjectOfAsset(asset);
    assertLoudly(
      asset.isKind('objects') && project,
      `Cannot create event for ${asset.kind} asset.`,
    );
    const existing = new Set(
      asset.listEvents().map((e) => e.event.name.toLowerCase()),
    );
    type EventChoice = vscode.QuickPickItem & {
      event?: ObjectEvent;
      collision?: boolean;
    };
    const choices: EventChoice[] = [];
    let lastGroup = '';
    const addSeparator = (group: string) => {
      if (group !== lastGroup && choices.length) {
        choices.push({
          label: group,
          kind: vscode.QuickPickItemKind.Separator,
        });
      }
      lastGroup = group;
    };
    for (const event of objectEvents) {
      if (existing.has(event.name.toLowerCase())) continue;
      addSeparator(event.group);
      choices.push({ label: event.label, event });
    }
    addSeparator('collision');
    choices.push({
      label: 'Collision...',
      description: 'Choose the other object',
      collision: true,
    });
    const choice = await vscode.window.showQuickPick(choices, {
      title: 'Select which type of event to create.',
    });
    if (!choice) return;

    let event = choice.event;
    if (choice.collision) {
      const other = await vscode.window.showQuickPick(
        project.gm
          .listAssets('objects')
          .filter((o) => !existing.has(`collision_${o.name.toLowerCase()}`))
          .map((o) => ({
            label: o.name,
            iconPath: getAssetIcon('objects', o),
          })),
        { title: `Create a collision event with which object?` },
      );
      if (!other) return;
      event = getEventFromFilename(`Collision_${other.label}`);
    }
    if (!event) return;
    const file = await this.attempt(() =>
      project.gm.createObjectEvent(asset, event),
    );
    if (!file) return;
    if (objectItem instanceof TreeAsset) {
      void this.view.reveal(objectItem, { expand: true });
    }
    await vscode.window.showTextDocument(vscode.Uri.file(file));
  }

  async createShader(where: GameMakerFolder) {
    const info = await this.prepareForNewAsset(where);
    if (!info) return;
    this.afterNewAssetCreated(
      await this.attempt(() => where.project!.gm.createShader(info.path)),
    );
  }

  async replaceSpriteFrames(item: TreeAsset) {
    const asset = item.asset;
    assertLoudly(asset.isKind('sprites'), 'Not a sprite');
    const project = item.project!;
    const spriteDir = await this.getSpriteSource();
    if (!spriteDir) return;
    // (In a transaction, so it can't interleave with other changes)
    await this.attempt(() =>
      project.gm.transaction(async () => {
        await applySpriteAction({
          action: {
            kind: 'update',
            name: asset.name,
            source: spriteDir.path.absolute,
            sourceRoot: '', // Not needed for this
            dest: asset.dir,
            spine: spriteDir.isSpine,
          },
          projectYypPath: project.gm.yypPath,
          yyp: project.gm.yyp,
        });
      }),
    );
    await project.gm.reconcile([asset.yyPath]);
    void this.view.reveal(item, { focus: true });
  }

  private async getSoundSources(): Promise<vscode.Uri[] | undefined> {
    const sourceFiles = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      openLabel: 'Import as Sound',
      title: 'Choose sound file(s) to import',
      filters: {
        Audio: ['ogg', 'mp3', 'wav'],
      },
    });
    if (!sourceFiles?.length) return;
    return sourceFiles;
  }

  private async getSpriteSource() {
    const sourceFolder = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Import as Sprite',
      title: 'Choose a folder containing sprite frames',
    });
    if (!sourceFolder?.length) return;

    const errors: Error[] = [];
    const spriteDir = await SpriteDir.from(
      pathy(sourceFolder[0].fsPath),
      [],
      errors,
    );
    assertLoudly(
      spriteDir,
      `Failed to create sprite from folder. ${errors
        .map((e) => e.message)
        .join(', ')}`,
    );

    // Prompt for bleed/crop options (note will mutate source)
    const preparations = await vscode.window.showQuickPick(
      [
        {
          label: 'Bleed',
          description:
            'Add a layer of low-alpha pixels around the foreground to improve aliasing.',
        },
        {
          label: 'Crop',
          description: 'Crop to reduce excessive bounding box size.',
        },
      ],
      { canPickMany: true, title: 'Source Mutations' },
    );
    if (preparations?.find((p) => p.label === 'Crop')) {
      await spriteDir.crop();
    }
    if (preparations?.find((p) => p.label === 'Bleed')) {
      await spriteDir.bleed();
    }
    return spriteDir;
  }

  async createSpriteFromImage(where: GameMakerFolder) {
    const project = where.project;
    assertLoudly(project, 'Cannot create sprite without a project.');
    const sourceImage = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: 'Import as Sprite',
      title: 'Choose an image',
      filters: {
        Image: ['png'],
      },
    });
    if (!sourceImage?.length) return;
    const sourceImagePath = pathyFromUri(sourceImage[0]);
    const name = await promptForAssetName(sourceImagePath.name);
    if (!name) return;
    this.afterNewAssetCreated(
      await this.attempt(() =>
        project.gm.createSprite(
          joinTreePath(where.path, name),
          sourceImagePath.absolute,
        ),
      ),
    );
  }

  async createSprite(where: GameMakerFolder) {
    const project = where.project;
    assertLoudly(project, 'Cannot create sprite without a project.');
    await project.reloadConfig();

    const spriteDir = await this.getSpriteSource();
    if (!spriteDir) return;

    const info = await this.prepareForNewAsset(where, spriteDir.path.name);
    if (!info) return;
    assertLoudly(
      isValidSpriteName(info.name, project.config),
      'Sprite name does not match allowed patterns.',
    );

    const created = await this.attempt(async () => {
      // Write the sprite's files (in a transaction, so this can't interleave
      // with other changes), then add it to the project
      await project.gm.transaction(async () => {
        await applySpriteAction({
          action: {
            kind: 'create',
            name: info.name,
            source: spriteDir.path.absolute,
            sourceRoot: '', // Not needed for this
            dest: project.dir.join('sprites').join(info.name).absolute,
            spine: spriteDir.isSpine,
          },
          projectYypPath: project.gm.yypPath,
          yyp: project.gm.yyp,
        });
      });
      return await project.gm.adoptAsset('sprites', info.path);
    });
    this.afterNewAssetCreated(created);
  }

  async createObject(where: GameMakerFolder) {
    const info = await this.prepareForNewAsset(where);
    if (!info) return;
    this.afterNewAssetCreated(
      await this.attempt(() => where.project!.gm.createObject(info.path)),
    );
  }

  async upsertSounds(where: GameMakerFolder, sourceFiles?: vscode.Uri[]) {
    const project = where.project;
    assertLoudly(project, 'Cannot upsert sounds without a project.');
    sourceFiles ||= await this.getSoundSources();
    if (!sourceFiles) return;
    await project.reloadConfig(); // Ensure we have the latest config

    const errors: Error[] = [];
    const updated: string[] = [];
    const created: string[] = [];
    for (const sourceFile of sourceFiles) {
      const sourcePath = pathyFromUri(sourceFile);
      try {
        // If there's an existing sound, just replace its audio file
        const existing = project.getAssetByName(sourcePath.name);
        if (existing?.isKind('sounds') && existing.soundFile) {
          await fs.copyFile(sourcePath.absolute, existing.soundFile);
          updated.push(sourcePath.name);
        } else {
          await project.gm.createSound(
            joinTreePath(where.path, sourcePath.name),
            sourcePath.absolute,
          );
          created.push(sourcePath.name);
        }
      } catch (err) {
        errors.push(err as Error);
      }
    }
    if (errors.length) {
      void showErrorMessage(
        `Failed to update sounds:\n${errors.map((e) => e.message).join(', ')}`,
      );
    }
    if (updated.length) {
      void vscode.window.showInformationMessage(
        `Updated sounds:\n${updated.join(', ')}`,
      );
    }
    if (created.length) {
      void vscode.window.showInformationMessage(
        `Created sounds:\n${created.join(', ')}`,
      );
    }
  }

  async createScript(where: GameMakerFolder) {
    const info = await this.prepareForNewAsset(where);
    if (!info) return;
    this.afterNewAssetCreated(
      await this.attempt(() => where.project!.gm.createScript(info.path)),
    );
  }

  async promptToRenameFolder(where: GameMakerFolder) {
    const newFolderName = await vscode.window.showInputBox({
      prompt: 'Provide a new name for this folder',
      ...getPathWithSelection(where),
      validateInput: validateFolderName,
    });
    if (!newFolderName) {
      return;
    }
    await this.renameFolder(where, newFolderName);
  }

  async promptToRenameAsset(where: TreeAsset) {
    const newName = await vscode.window.showInputBox({
      prompt: 'Provide a new name for this asset',
      placeHolder: where.asset.name,
      validateInput(value) {
        if (!value) {
          return;
        }
        if (!value.match(/^[a-z_][a-z0-9_]*$/i)) {
          return 'Asset names must start with a letter or underscore, and can only contain letters, numbers, and underscores.';
        }
        return;
      },
    });
    if (!newName) return;
    const renamed = await showProgress(
      () =>
        this.attempt(() => this.workspace.renameAsset(where.asset, newName)),
      `Renaming ${where.asset.name} to ${newName}...`,
    );
    if (!renamed) return;
    this.rebuild();
    this.reveal(renamed);
  }

  async suppressDiagnostics(where: GameMakerFolder) {
    const suppressed = stitchConfig.suppressDiagnosticsInGroups;
    const path = where.path;
    if (suppressed.includes(path)) {
      return;
    }
    suppressed.push(path);
    // (The language server is sent the new settings)
    await stitchConfig.config.update('diagnostics.suppressGroups', suppressed);
  }

  protected async renameFolder(where: GameMakerFolder, newFolderName: string) {
    await this.attempt(() =>
      where.project!.gm.renameFolder(where.path, newFolderName),
    );
    this.rebuild();
    this.reveal(newFolderName);
  }

  async deleteFolder(where: GameMakerFolder) {
    try {
      await where.project!.gm.deleteFolder(where.path);
    } catch {
      void showErrorMessage(
        `Folders can only be deleted if they contain no assets.`,
      );
      return;
    }
    this.rebuild();
  }

  async deleteSpriteFrame(item: TreeSpriteFrame) {
    await this.attempt(() =>
      item.project!.gm.deleteSpriteFrames(item.parent.asset, [item.frameId]),
    );
  }

  async duplicateAsset(item: TreeAsset) {
    const dest = await this.prepareForNewAsset(item.parent);
    if (!dest) return;
    this.afterNewAssetCreated(
      await this.attempt(() =>
        item.project!.gm.duplicateAsset(item.asset, dest.path),
      ),
    );
  }

  /** Create a new folder in the GameMaker asset tree */
  async createFolder(where: GameMakerFolder | undefined) {
    const project = where?.project ?? this.projects[0];
    if (!project) return;
    const basePath = where?.path ? where.path + '/' : '';
    const newFolderName = await vscode.window.showInputBox({
      prompt: 'Enter a name for the new folder',
      value: basePath,
      valueSelection: [basePath.length, basePath.length],
      placeHolder: 'e.g. my/new/folder',
      validateInput: validateFolderName,
    });
    if (!newFolderName) {
      return;
    }
    const created = await this.attempt(() =>
      project.gm.createFolder(newFolderName),
    );
    if (!created) return;
    this.rebuild();
    this.reveal(created);
  }

  getTreeItem(element: Treeable): vscode.TreeItem {
    return element;
  }

  getParent(element: Treeable): vscode.ProviderResult<Treeable> {
    return element.parent;
  }

  getChildren(element?: Treeable | undefined): Treeable[] | undefined {
    const assetSorter = (a: TreeAsset, b: TreeAsset) => {
      return a.asset.name
        .toLowerCase()
        .localeCompare(b.asset.name.toLowerCase());
    };
    const folderSorter = (a: GameMakerFolder, b: GameMakerFolder) => {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    };

    if (!element) {
      // If there is only one project, show its contents at the root
      if (this.projects.length === 1) {
        return this.getChildren(this.tree.folders[0]);
      } else {
        return this.tree.folders;
      }
    } else if (element instanceof GameMakerProjectFolder) {
      return [
        element.filterGroup,
        ...element.folders.sort(folderSorter),
        ...element.resources.sort(assetSorter),
      ];
    } else if (element instanceof GameMakerFolder) {
      return [
        ...element.folders.sort(folderSorter),
        ...element.resources.sort(assetSorter),
      ];
    } else if (element instanceof TreeFilterGroup) {
      return element.filters.sort((a, b) => a.query.localeCompare(b.query));
    } else if (element instanceof TreeAsset) {
      const asset = element.asset;
      if (asset.isKind('objects')) {
        return TreeCode.listFor(asset, element);
      } else if (asset.isKind('sprites')) {
        return asset.framePaths.map(
          (p, i) => new TreeSpriteFrame(element as TreeAsset<'sprites'>, p, i),
        );
      } else if (asset.isKind('shaders') && asset.shaderPaths) {
        return [
          new TreeShaderFile(element, asset.shaderPaths.fragment),
          new TreeShaderFile(element, asset.shaderPaths.vertex),
        ];
      } else if (asset.isKind('rooms')) {
        const project = element.project;
        return asset.roomInstances.map((i) => {
          const object = project?.getAssetByName(i.objectName);
          return new TreeRoomInstance(
            element as TreeAsset<'rooms'>,
            object?.isKind('objects') ? object : undefined,
            i.objectName,
            i.instanceId,
          );
        });
      }
    }
    return;
  }

  rebuild() {
    const toReveal: Treeable[] = [];

    // Grab the current filters before nuking everything.
    const filterGroups = new Map<StitchProject, TreeFilterGroup>();
    for (const projectFolder of this.tree.folders) {
      filterGroups.set(projectFolder.project, projectFolder.filterGroup);
    }

    // Rebuild the tree
    TreeAsset.lookup.clear();
    GameMakerFolder.lookup.clear();
    this.tree = new GameMakerRootFolder();
    for (const project of this.projects) {
      const projectFolder = this.tree.addFolder(project.name, {
        project,
      }) as GameMakerProjectFolder;
      const existingFilters = filterGroups.get(project);
      if (existingFilters) {
        projectFolder.filterGroup = existingFilters;
      }

      const query = projectFolder.filterGroup.enabled?.query;
      const filter = query?.length ? new RegExp(query, 'i') : undefined;

      const addFolders = (folderPath: string, open = false) => {
        let parent = projectFolder as GameMakerFolder;
        for (const part of folderPath.split('/').filter(Boolean)) {
          parent = parent.addFolder(part, { open });
        }
        return parent;
      };

      // Add all of the folders, unless we're filtering
      if (!filter) {
        for (const folder of project.gm.folders) addFolders(folder);
      }

      // Add the assets, applying the filter if any
      for (const asset of project.gm.assets) {
        if (filter && !asset.name.match(filter)) {
          continue;
        }
        const parent = addFolders(
          asset.folder,
          !!filter && stitchConfig.openFoldersOnFilter,
        );
        const item = new TreeAsset(parent, asset);
        parent.addResource(item);
        if (filter) {
          toReveal.push(item);
        }
      }
    }
    this.changed();
    for (const element of toReveal) {
      void this.view?.reveal(element, {
        focus: false,
        expand: false,
        select: false,
      });
    }
    return this;
  }

  async createFilter(group: TreeFilterGroup) {
    const query = await vscode.window.showInputBox({
      prompt: 'Provide a query term to filter the tree',
    });
    if (!query) {
      return;
    }
    const filter = group.addFilter(query);
    this.rebuild();
    void this.view.reveal(filter);
  }

  async editFilter(filter: TreeFilter) {
    const query = await vscode.window.showInputBox({
      prompt: 'Update the asset filter query',
      value: filter.query,
    });
    if (!query) {
      return;
    }
    filter.query = query;
    this.rebuild();
    void this.view.reveal(filter);
  }

  deleteFilter(filter: TreeFilter) {
    const requiresRefresh = filter.enabled;
    filter.delete();
    if (requiresRefresh) {
      this.rebuild();
    } else {
      this.changed(filter.parent);
    }
  }

  enableFilter(filter: TreeFilter) {
    filter.parent.enable(filter);
    this.rebuild();
  }

  disableFilter(filter: TreeFilter) {
    filter.parent.disable(filter);
    this.rebuild();
  }

  register() {
    this.view = vscode.window.createTreeView('bscotch-stitch-resources', {
      treeDataProvider: this.rebuild(),
      canSelectMany: true,
      dragAndDropController: this,
    });

    // Return subscriptions to owned commands and this view
    const subscriptions = [
      this.view,
      registerCommand('stitch.assets.import', this.importAssets.bind(this)),
      registerCommand(
        'stitch.assets.renameFolder',
        this.promptToRenameFolder.bind(this),
      ),
      registerCommand(
        'stitch.assets.deleteFolder',
        this.deleteFolder.bind(this),
      ),
      registerCommand(
        'stitch.assets.deleteSpriteFrame',
        this.deleteSpriteFrame.bind(this),
      ),
      registerCommand(
        'stitch.diagnostics.suppress',
        this.suppressDiagnostics.bind(this),
      ),
      registerCommand(
        'stitch.assets.rename',
        this.promptToRenameAsset.bind(this),
      ),
      registerCommand(
        'stitch.assets.editSprite',
        (item: TreeAsset | Asset | undefined) => this.editSprite(item),
      ),
      registerCommand(
        'stitch.assets.editSound',
        (item: TreeAsset | Asset | undefined) => this.editSound(item),
      ),
      registerCommand(
        'stitch.assets.duplicate',
        this.duplicateAsset.bind(this),
      ),
      registerCommand('stitch.assets.newSound', this.upsertSounds.bind(this)),
      registerCommand('stitch.assets.newFolder', this.createFolder.bind(this)),
      registerCommand('stitch.assets.newScript', this.createScript.bind(this)),
      registerCommand('stitch.assets.newObject', this.createObject.bind(this)),
      registerCommand('stitch.assets.newSprite', this.createSprite.bind(this)),
      registerCommand(
        'stitch.assets.newSpriteFromImage',
        this.createSpriteFromImage.bind(this),
      ),
      registerCommand(
        'stitch.assets.replaceSpriteFrames',
        this.replaceSpriteFrames.bind(this),
      ),
      registerCommand('stitch.assets.newShader', this.createShader.bind(this)),
      registerCommand('stitch.assets.newRoom', this.createRoom.bind(this)),
      registerCommand('stitch.assets.newEvent', this.createEvent.bind(this)),
      registerCommand('stitch.assets.setParent', this.setParent.bind(this)),
      registerCommand('stitch.assets.setSprite', this.setSprite.bind(this)),
      registerCommand(
        'stitch.assets.addRoomInstance',
        this.addRoomInstance.bind(this),
      ),
      registerCommand(
        'stitch.assets.deleteRoomInstance',
        this.deleteRoomInstance.bind(this),
      ),
      registerCommand('stitch.assets.reveal', this.reveal.bind(this)),
      registerCommand(
        'stitch.assets.filters.delete',
        this.deleteFilter.bind(this),
      ),
      registerCommand(
        'stitch.assets.filters.enable',
        this.enableFilter.bind(this),
      ),
      registerCommand(
        'stitch.assets.filters.disable',
        this.disableFilter.bind(this),
      ),
      registerCommand(
        'stitch.assets.filters.new',
        this.createFilter.bind(this),
      ),
      registerCommand('stitch.assets.filters.edit', this.editFilter.bind(this)),
    ];
    return subscriptions;
  }
}
