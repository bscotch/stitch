import {
  Project,
  type Asset,
  type Code,
  type DiagnosticsEventPayload,
  type FunctionArgRange,
  type OnDiagnostics,
  type Reference,
  type ReferenceableType,
} from '@bscotch/gml-parser';
import { Yy, yypSchema } from '@bscotch/yy';
import { randomUUID } from 'node:crypto';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { ChangeTracker } from './changes.mjs';
import { stitchConfig } from './config.mjs';
import {
  diagnosticCollection,
  normalizeDiagnosticsEvents,
} from './diagnostics.mjs';
import { stitchEvents } from './events.mjs';
import { activateStitchExtension } from './extension.activate.mjs';
import { completionTriggerCharacters } from './extension.completions.mjs';
import { GameMakerSemanticTokenProvider } from './extension.highlighting.mjs';
import { GameMakerProject } from './extension.project.mjs';
import {
  activeTab,
  isSpriteTab,
  openPath,
  pathyFromUri,
  showProgress,
} from './lib.mjs';
import { info, logger, warn } from './log.mjs';

export class StitchWorkspace implements vscode.SignatureHelpProvider {
  readonly semanticHighlightProvider = new GameMakerSemanticTokenProvider(this);
  readonly signatureHelpStatus = vscode.window.createStatusBarItem(
    stitchConfig.functionSignatureStatusAlignment,
    stitchConfig.functionSignatureStatusAlignment ===
      vscode.StatusBarAlignment.Left
      ? -Infinity
      : Infinity,
  );
  readonly diagnosticCollection = diagnosticCollection;
  readonly externalChangeTracker = new ChangeTracker(this);

  projects: GameMakerProject[] = [];

  readonly processingFiles = new Map<string, Promise<any>>();
  readonly debouncingOnChange = new Map<string, NodeJS.Timeout>();

  protected constructor(readonly ctx: vscode.ExtensionContext) {
    this.signatureHelpStatus.hide();
  }

  clearDiagnosticsInGroups(groups: string[]) {
    if (!groups.length) return;
    for (const project of this.projects) {
      for (const [, asset] of project.assets) {
        for (const group of groups) {
          if (asset.isInFolder(group)) {
            for (const [, code] of asset.gmlFiles) {
              this.diagnosticCollection.delete(
                vscode.Uri.file(code.path.absolute),
              );
            }
          }
        }
      }
    }
  }

  /**
   * Emit a collection of diagnostics for a particular file. */
  emitDiagnostics(payload: DiagnosticsEventPayload) {
    const suppresedGroups = stitchConfig.suppressDiagnosticsInGroups;
    for (const group of suppresedGroups) {
      if (payload.code?.asset.isInFolder(group)) {
        // Then skip this file!
        return;
      }
    }
    this.diagnosticCollection.set(
      vscode.Uri.file(payload.filePath),
      normalizeDiagnosticsEvents(payload),
    );
  }

  clearProjects() {
    this.projects = [];
    void vscode.commands.executeCommand(
      'setContext',
      'stitch.projectCount',
      this.projects.length,
    );
  }

  async loadProject(yypPath: vscode.Uri, onDiagnostics: OnDiagnostics) {
    let project!: GameMakerProject;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Stitch: Loading project from ${pathyFromUri(yypPath).basename}`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({
          increment: 0,
        });
        project = await GameMakerProject.from(
          yypPath,
          onDiagnostics,
          (percent, message) => {
            progress.report({
              increment: percent,
              message,
            });
          },
        );
        try {
          await project.syncIncludedFiles();
        } catch {}
        progress.report({
          increment: 100,
          message: 'Done!',
        });
      },
    );
    this.projects.push(project);
    void vscode.commands.executeCommand(
      'setContext',
      'stitch.projectCount',
      this.projects.length,
    );
    return project;
  }

  async deleteAsset(asset: Asset) {
    await asset.project.removeAssetByName(asset.name);
    stitchEvents.emit('asset-deleted', asset);
  }

  provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.SignatureHelp | undefined {
    const argRange = this.getFunctionArg(document, position);
    if (!argRange?.param?.parent) {
      return;
    }
    const param = argRange.param;
    const func = argRange.type;
    // Create the signature help
    const signature = new vscode.SignatureInformation(
      func.code,
      func.description,
    );
    signature.activeParameter = param.idx!;
    signature.parameters = func.listParameters().map((p) => {
      return new vscode.ParameterInformation(
        p?.name || 'unknown',
        p?.description,
      );
    });
    const help = new vscode.SignatureHelp();
    help.signatures = [signature];
    help.activeSignature = 0;
    help.activeParameter = param.idx!;
    return help;
  }

  /**
   * Determine the project the file belongs to,
   * and pass an update request to that project.
   */
  async updateFile(document: vscode.TextDocument): Promise<Code | undefined> {
    const code = this.getGmlFile(document);
    await code?.reload(document.getText(), {
      reloadDirty: true,
    });
    return code;
  }

  getActiveDocument(): vscode.TextDocument | undefined {
    return vscode.window.activeTextEditor?.document;
  }

  getActiveProject(): GameMakerProject | undefined {
    const doc = this.getActiveDocument();
    const project = doc ? this.getProject(doc) : undefined;
    return project || this.projects[0];
  }

  /** Given a URI, get the project that contains that file */
  getProject(
    document: vscode.TextDocument | vscode.Uri,
  ): GameMakerProject | undefined {
    if (!document) {
      return;
    }
    return this.projects.find((p) => p.includesFile(document));
  }

  /** If there is only one project in the workspace, return it. Otherwise prompt the user. */
  async chooseProject(
    title = 'Choose a project',
  ): Promise<GameMakerProject | undefined> {
    if (this.projects.length === 1) {
      return this.projects[0];
    }
    // Create a quickpick
    const projectName = await vscode.window.showQuickPick(
      this.projects.map((p) => p.name),
      { title },
    );
    if (!projectName) return;
    return this.projects.find((p) => p.name === projectName);
  }

  getFunctionArg(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): FunctionArgRange | undefined {
    const offset = document.offsetAt(position);
    return this.getGmlFile(document)?.getFunctionArgRangeAt(offset);
  }

  getReference(
    where: vscode.TextDocument | vscode.Uri,
    position: vscode.Position,
  ): Reference | undefined {
    const document =
      where instanceof vscode.Uri
        ? vscode.workspace.textDocuments.find(
            (d) => d.uri.fsPath === where.fsPath,
          )
        : where;
    if (!document) {
      return;
    }
    const offset = document.offsetAt(position);
    const file = this.getGmlFile(document);
    if (!file) {
      warn(`Could not find file for ${document}`);
      return;
    }
    const ref = file.getReferenceAt(offset);
    if (!ref) {
      warn(`Could not find reference at ${offset}`);
      return;
    }
    return ref;
  }

  getSignifier(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): ReferenceableType | undefined {
    const ref = this.getReference(document, position);
    if (!ref) {
      return;
    }
    const item = ref.item;
    if (!item) {
      warn(`Could not find symbol for ${ref}`);
      return;
    }
    return item;
  }

  getSprite(
    document: vscode.TextDocument,
    name: string,
  ): Asset<'sprites'> | undefined {
    const asset = this.getAsset(document, name);
    if (asset && asset.assetKind === 'sprites') {
      return asset as Asset<'sprites'>;
    }
    return;
  }

  getCurrentAsset() {
    const tab = activeTab();
    if (!tab) {
      return;
    }
    if (isSpriteTab(tab)) {
      // Then we have the asset name, get the first project
      // that has that name.
      const project = this.projects.find((p) =>
        p.getAssetByName(tab.assetName),
      );
      return project?.getAssetByName(tab.assetName);
    }
    // Otherwise we have a full URI so we can find the project
    // and asset.
    const currentProject = this.getProject(tab.uri);
    return currentProject?.getAsset(pathyFromUri(tab.uri));
  }

  getAsset(document: vscode.TextDocument, name?: string): Asset | undefined {
    const project = this.getProject(document);
    if (!project) {
      warn(`getAsset: Could not find project for`, document);
      return;
    }
    name ||= pathyFromUri(document).name;
    const asset = project.getAssetByName(name);
    return asset;
  }

  getGmlFile(
    document: vscode.TextDocument | vscode.Uri | undefined,
  ): Code | undefined {
    document ||= this.getActiveDocument();
    if (!document) {
      // warn(`getGmlFile: Could not find document`);
      return;
    }
    const path = pathyFromUri(document);
    if (!path.hasExtension('gml')) return;
    const project = this.getProject(document);
    if (!project) {
      warn(`getGmlFile: Could not find project for`, path);
      return;
    }
    const file = project.getGmlFile(path);
    if (!file) {
      warn(`getGmlFile: Could not find file for ${path.absolute}`);
      return;
    }
    return file;
  }

  getRefFromSelection(
    document?: vscode.TextDocument,
    selection?: readonly vscode.Selection[],
  ) {
    document ||= vscode.window.activeTextEditor?.document;
    if (
      !document ||
      document.uri.scheme !== 'file' ||
      !document.uri.fsPath.endsWith('.gml')
    ) {
      return;
    }
    const file = this.getGmlFile(document);
    if (!file) return;

    // Get the reference at the cursor
    selection ||= vscode.window.activeTextEditor?.selections;
    if (!selection) return;
    const start = selection[0].start;
    const ref = file.getReferenceAt(start.line + 1, start.character);
    return ref;
  }

  /**
   * A general function for reprocessing files upon change. Handles
   * debounding and the like.
   */
  async onChangeDoc(
    event: vscode.TextDocumentChangeEvent | vscode.TextDocument | undefined,
  ) {
    if (!event) {
      return;
    }
    const doc = 'document' in event ? event.document : event;
    if (doc.languageId !== 'gml') {
      return;
    }

    // While actively typing, we don't want to reprocess on
    // every keystroke since that'll make things feel sluggish.
    // So for calls to this function triggered by typing, we
    // only immediately reprocess if the character is a trigger
    // character. Otherwise, we debounce.
    if (
      'contentChanges' in event &&
      event.contentChanges.length === 1 &&
      event.contentChanges[0].text.length
    ) {
      const isTriggerCharacter = [
        ...completionTriggerCharacters,
        ' ',
        '\r\n',
        '\n',
        ';',
        ',',
      ].includes(event.contentChanges[0].text as any);
      if (!isTriggerCharacter) {
        // TODO: Debounce this so that we still get reprocessing
        // while editing, but only when not actively typing.
        clearTimeout(this.debouncingOnChange.get(doc.uri.fsPath));
        this.debouncingOnChange.set(
          doc.uri.fsPath,
          setTimeout(() => {
            this.onChangeDoc(doc);
          }, stitchConfig.reprocessOnTypeDelay),
        );
        return;
      }
    }

    if (this.processingFiles.has(doc.uri.fsPath)) {
      logger.info('Already processing file', doc.uri.fsPath);
      return;
    }

    this.diagnosticCollection.delete(doc.uri);
    // Add the processing promise to a map so
    // that other functionality can wait for it
    // to complete.
    const updateWait = StitchWorkspace.provider.updateFile(doc).finally(() => {
      // Semantic highlighting is normally updated by VSCode
      // upon change. But since we're delaying processing of the
      // file, we need to manually trigger a refresh.
      this.semanticHighlightProvider.refresh();
    });
    this.processingFiles.set(doc.uri.fsPath, updateWait);
    await updateWait;
    this.processingFiles.delete(doc.uri.fsPath);
  }

  async createNewProject() {
    const project = this.getActiveProject();
    assertLoudly(project, 'Must have an active project to use as a temiplate.');

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
    // @ts-expect-error We'll rely on the yywriter to complete
    yyp.RoomOrderNodes = [{ roomId: { name: roomName } }];

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
        Yy.write(
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

      // Load as a project
      const newProject = await Project.initialize(yypPath.absolute);
      // Add the default object
      await newProject.createObject(`${resourceFolder}/${objName}`);
      // Add the default room
      await newProject.createRoom(`${resourceFolder}/${roomName}`);
      // Add an object instance to the room

      // TODO: Open the new project folder in a new window
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
}
