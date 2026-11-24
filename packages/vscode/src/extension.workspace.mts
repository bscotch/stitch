import { GameMakerProject, type Asset } from '@bscotch/gamemaker-project';
import {
  assetRenameEditsRequest,
  symbolInfoRequest,
  type AssetRenameEditsParams,
  type SymbolInfo,
  type SymbolInfoParams,
} from '@bscotch/gml-language-server/protocol';
import { Yy, yypSchema } from '@bscotch/yy';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import vscode from 'vscode';
import type { WorkspaceEdit } from 'vscode-languageclient/node';
import { assertLoudly } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import { stitchEvents } from './events.mjs';
import { activateStitchExtension } from './extension.activate.mjs';
import { StitchProject } from './extension.project.mjs';
import type { GameMakerTreeProvider } from './tree.mjs';
import { sendSettings, startLanguageClient } from './languageClient.mjs';
import {
  activeTab,
  isSpriteTab,
  openPath,
  pathyFromUri,
  showProgress,
} from './lib.mjs';
import { info, logger, showErrorMessage, warn } from './log.mjs';

export class StitchWorkspace {
  readonly signatureHelpStatus = vscode.window.createStatusBarItem(
    stitchConfig.functionSignatureStatusAlignment,
    stitchConfig.functionSignatureStatusAlignment ===
      vscode.StatusBarAlignment.Left
      ? -Infinity
      : Infinity,
  );

  projects: StitchProject[] = [];
  /** The asset tree (set on activation) */
  tree?: GameMakerTreeProvider;

  /**
   * If `true`, the project has not been run since the last clean (so the
   * cache is already clean). Used to decide whether a change to a Spine
   * atlas file should trigger a clean.
   */
  protected igorCacheIsClean = false;

  protected constructor(readonly ctx: vscode.ExtensionContext) {
    this.signatureHelpStatus.hide();
    stitchEvents.on(
      'clean-project-start',
      () => (this.igorCacheIsClean = true),
    );
    stitchEvents.on('run-project-start', () => (this.igorCacheIsClean = false));
  }

  protected setProjectCount() {
    void vscode.commands.executeCommand(
      'setContext',
      'stitch.projectCount',
      this.projects.length,
    );
  }

  async clearProjects() {
    const projects = this.projects;
    this.projects = [];
    this.setProjectCount();
    await Promise.all(projects.map((p) => p.dispose()));
  }

  //#region Loading

  /**
   * Load a project: its files, a watcher that keeps them up to date, and a
   * language server for its code.
   */
  async loadProject(yypPath: vscode.Uri): Promise<StitchProject> {
    const project = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Stitch: Loading project from ${path.basename(yypPath.fsPath)}`,
        cancellable: false,
      },
      () => StitchProject.open(yypPath.fsPath),
    );
    this.projects.push(project);
    this.setProjectCount();
    this.followProjectEvents(project);
    try {
      await project.gm.syncIncludedFiles();
    } catch (err) {
      logger.warn('Could not sync included files', err);
    }

    const watchers = this.watchProjectFiles(project);
    this.ctx.subscriptions.push(...watchers);
    try {
      project.client = await startLanguageClient(this.ctx, project, watchers);
    } catch (err) {
      logger.error('Could not start the language server', err);
      void showErrorMessage(
        `Could not start the GML language server for ${project.name}. See the Stitch output for details.`,
      );
    }
    return project;
  }

  /**
   * Watch the project's files. Changes go to the project (and, through the
   * language client, to the language server).
   */
  protected watchProjectFiles(project: StitchProject) {
    const base = vscode.Uri.file(project.gm.dir);
    const watchers = [
      '*.yyp',
      'stitch.config.json',
      '*/*/*',
      'datafiles/**/*',
    ].map((pattern) =>
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(base, pattern),
      ),
    );
    const onChange = (
      uri: vscode.Uri,
      type: 'create' | 'change' | 'delete',
    ) => {
      project.gm.notifyChanged(uri.fsPath);
      if (type === 'change' && uri.fsPath.endsWith('.atlas')) {
        this.onSpineAtlasChanged(project, uri);
      }
    };
    for (const watcher of watchers) {
      watcher.onDidCreate((uri) => onChange(uri, 'create'));
      watcher.onDidChange((uri) => onChange(uri, 'change'));
      watcher.onDidDelete((uri) => onChange(uri, 'delete'));
    }
    return watchers;
  }

  protected onSpineAtlasChanged(project: StitchProject, uri: vscode.Uri) {
    const shouldClean =
      stitchConfig.cleanOnSpineSpriteChange && !this.igorCacheIsClean;
    logger.info(
      `atlas file "${uri.fsPath}" changed on disk.`,
      shouldClean ? 'Cleaning!' : 'Skipping cache-clean.',
    );
    if (shouldClean) {
      this.igorCacheIsClean = true;
      void project.run({ clean: true });
    }
  }

  /** Turn the project's change events into Stitch events for the UI */
  protected followProjectEvents(project: StitchProject) {
    const gm = project.gm;
    let structureTimer: NodeJS.Timeout | undefined;
    const structureChanged = () => {
      // (Changes often come in bursts, e.g. during a git pull)
      clearTimeout(structureTimer);
      structureTimer = setTimeout(
        () => stitchEvents.emit('project-changed', project),
        50,
      );
    };
    gm.on('assetAdded', structureChanged);
    gm.on('assetRemoved', structureChanged);
    gm.on('yypChanged', structureChanged);
    gm.on('assetChanged', (asset) => stitchEvents.emit('asset-changed', asset));
    gm.on('includedFilesChanged', async () => {
      try {
        await gm.syncIncludedFiles();
      } catch (err) {
        logger.warn('Could not sync included files', err);
      }
      stitchEvents.emit('datafiles-changed', project);
    });
    gm.on('error', (err) => logger.warn('Project file problem:', err.message));
  }

  /** Send changed settings to the language servers */
  onSettingsChanged() {
    for (const project of this.projects) sendSettings(project.client);
  }

  //#endregion

  //#region Changing assets

  /**
   * Rename an asset: update the code that refers to it, then rename its
   * files and the references to it in other assets' yy files.
   */
  async renameAsset(asset: Asset, newName: string): Promise<Asset> {
    const project = this.getProjectOfAsset(asset);
    assertLoudly(project, `Could not find the project for ${asset.name}`);
    const oldDir = path.normalize(asset.dir);
    // Code edits first, while the language server still knows the old name
    if (project.client) {
      const params: AssetRenameEditsParams = { name: asset.name, newName };
      const lspEdit: WorkspaceEdit = await project.client.sendRequest(
        assetRenameEditsRequest,
        params,
      );
      const edit =
        await project.client.protocol2CodeConverter.asWorkspaceEdit(lspEdit);
      if (edit.size) {
        assertLoudly(
          await vscode.workspace.applyEdit(edit),
          'Could not update the code that refers to this asset.',
        );
        // Save, so the edits are on disk before files are moved
        for (const [uri] of edit.entries()) {
          const document = vscode.workspace.textDocuments.find(
            (d) => d.uri.toString() === uri.toString(),
          );
          await document?.save();
        }
      }
    }
    // Note any of the asset's files that are open, to reopen them afterwards
    const openTabs = vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter(
        (tab) =>
          tab.input instanceof vscode.TabInputText &&
          path.normalize(tab.input.uri.fsPath).startsWith(oldDir + path.sep),
      );
    const renamed = await project.gm.renameAsset(asset, newName);
    for (const tab of openTabs) {
      const oldFile = (tab.input as vscode.TabInputText).uri.fsPath;
      const newFile = path.join(
        renamed.dir,
        path.basename(oldFile).replace(asset.name, renamed.name),
      );
      await vscode.window.tabGroups.close(tab).then(
        () =>
          vscode.window.showTextDocument(vscode.Uri.file(newFile), {
            preview: false,
            preserveFocus: true,
          }),
        () => undefined,
      );
    }
    return renamed;
  }

  async deleteAsset(asset: Asset) {
    const project = this.getProjectOfAsset(asset);
    assertLoudly(project, `Could not find the project for ${asset.name}`);
    const { danglingReferences } = await project.gm.deleteAsset(asset);
    if (danglingReferences.length) {
      void vscode.window.showWarningMessage(
        `Deleted ${asset.name}, but these still refer to it: ${danglingReferences.join(', ')}`,
      );
    }
  }

  //#endregion

  //#region Lookups

  getActiveDocument(): vscode.TextDocument | undefined {
    return vscode.window.activeTextEditor?.document;
  }

  getActiveProject(): StitchProject | undefined {
    const doc = this.getActiveDocument();
    const project = doc ? this.getProject(doc) : undefined;
    return project || this.projects[0];
  }

  /** Given a URI, get the project that contains that file */
  getProject(
    document: vscode.TextDocument | vscode.Uri | undefined,
  ): StitchProject | undefined {
    if (!document) return;
    return this.projects.find((p) => p.includesFile(document));
  }

  getProjectOfAsset(asset: Asset): StitchProject | undefined {
    return this.projects.find((p) => p.gm.getAsset(asset.name) === asset);
  }

  /** If there is only one project in the workspace, return it. Otherwise prompt the user. */
  async chooseProject(
    title = 'Choose a project',
  ): Promise<StitchProject | undefined> {
    if (this.projects.length === 1) {
      return this.projects[0];
    }
    const projectName = await vscode.window.showQuickPick(
      this.projects.map((p) => p.name),
      { title },
    );
    if (!projectName) return;
    return this.projects.find((p) => p.name === projectName);
  }

  /** The asset whose file (or sprite editor) is in the active tab */
  getCurrentAsset(): Asset | undefined {
    const tab = activeTab();
    if (!tab) {
      return;
    }
    if (isSpriteTab(tab)) {
      for (const project of this.projects) {
        const asset = project.getAssetByName(tab.assetName);
        if (asset) return asset;
      }
      return;
    }
    return this.getProject(tab.uri)?.getAssetByPath(tab.uri);
  }

  /** The asset a document belongs to, or an asset by name in its project */
  getAsset(document: vscode.TextDocument, name?: string): Asset | undefined {
    const project = this.getProject(document);
    if (!project) {
      warn(`getAsset: Could not find project for`, document.uri.fsPath);
      return;
    }
    return name
      ? project.getAssetByName(name)
      : project.getAssetByPath(document.uri);
  }

  /** Ask the language server about the symbol at a position */
  async getSymbolInfo(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<SymbolInfo | undefined> {
    const client = this.getProject(document)?.client;
    if (!client || document.languageId !== 'gml') return;
    const params: SymbolInfoParams = {
      textDocument: { uri: document.uri.toString() },
      position: { line: position.line, character: position.character },
    };
    try {
      return (
        (await client.sendRequest<SymbolInfo | null>(
          symbolInfoRequest,
          params,
        )) ?? undefined
      );
    } catch (err) {
      logger.warn('Could not get symbol info', err);
      return;
    }
  }

  /** The symbol at the cursor in the active editor */
  async getSymbolAtCursor(): Promise<SymbolInfo | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    return await this.getSymbolInfo(editor.document, editor.selection.active);
  }

  /** The asset referred to at the cursor in the active editor, if any */
  async getAssetAtCursor(): Promise<Asset | undefined> {
    const symbol = await this.getSymbolAtCursor();
    if (symbol?.kind !== 'asset') return;
    const document = vscode.window.activeTextEditor!.document;
    return this.getProject(document)?.getAssetByName(symbol.name);
  }

  //#endregion

  async createNewProject() {
    const project = this.getActiveProject();
    assertLoudly(project, 'Must have an active project to use as a template.');

    // Clone the current yyp file
    const roomName = 'rm_init';
    const objName = 'o_init';
    const resourceFolder = 'Init';
    let yyp = structuredClone(project.yyp);
    // Remove its contents
    yyp.IncludedFiles = [];
    yyp.resources = [];
    yyp.LibraryEmitters = [];
    yyp.Folders = [];
    yyp.configs.children = [];
    // @ts-expect-error We'll rely on the yywriter to complete
    yyp.AudioGroups = [{ name: 'audiogroup_default' }];
    // @ts-expect-error We'll rely on the yywriter to complete
    yyp.TextureGroups = [{ name: 'default' }];
    yyp.RoomOrderNodes = [];

    // Prompt for the project name
    const projectName = await vscode.window.showInputBox({
      prompt: 'Enter a name for the new project',
      value: 'NewProject',
    });
    if (!projectName) return;

    yyp.name = projectName;
    yyp = yypSchema.parse(yyp);

    const where = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: `Choose a parent folder for the "${projectName}" project folder`,
      openLabel: `Create project in folder`,
    });
    if (!where?.length) return;

    await showProgress(async () => {
      const parentDir = pathyFromUri(where[0]);
      await parentDir.ensureDir();
      const dir = parentDir.join(projectName);
      await dir.ensureDir();
      const yypPath = dir.join(`${projectName}.yyp`);
      assertLoudly(!(await yypPath.exists()), `That project already exists!`);
      await Yy.write(yypPath.absolute, yyp, 'project');
      if (yyp['%Name']) {
        // Then this is in the new format. Requires a main options file
        const optionsDir = dir.join('options/main');
        await optionsDir.ensureDir();
        const optionsPath = optionsDir.join('options_main.yy');
        await Yy.write(
          optionsPath.absolute,
          {
            $GMMainOptions: '',
            '%Name': 'Main',
            name: 'Main',
            option_author: '',
            option_collision_compatibility: false,
            option_copy_on_write_enabled: false,
            option_draw_colour: 4294967295,
            option_gameguid: randomUUID(),
            option_gameid: '0',
            option_game_speed: 60,
            option_mips_for_3d_textures: false,
            option_sci_usesci: false,
            option_spine_licence: false,
            option_steam_app_id: '0',
            option_template_description: null,
            option_template_icon: '${base_options_dir}/main/template_icon.png',
            option_template_image:
              '${base_options_dir}/main/template_image.png',
            option_window_colour: 255,
            resourceType: 'GMMainOptions',
            resourceVersion: '2.0',
          },
          undefined,
        );
      }

      // Add a starting object and room, with an instance of the object
      const newProject = await GameMakerProject.open(yypPath.absolute);
      const obj = await newProject.createObject(`${resourceFolder}/${objName}`);
      const room = await newProject.createRoom(`${resourceFolder}/${roomName}`);
      await newProject.addRoomInstance(room, obj);

      await openPath(dir);
    }, 'Creating new project...');
  }

  /**
   * Only allow a single instance at a time.
   */
  protected static provider: StitchWorkspace;

  static async activate(ctx: vscode.ExtensionContext) {
    info('Activating extension...');
    if (this.provider) {
      info('Extension already active!');
      return this.provider;
    }
    this.provider = new StitchWorkspace(ctx);
    await activateStitchExtension(this.provider, ctx);
    return this.provider;
  }

  static async deactivate() {
    await this.provider?.clearProjects();
  }
}
