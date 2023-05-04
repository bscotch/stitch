import { Pathy, pathy } from '@bscotch/pathy';
import {
  Yy,
  YyResourceType,
  YySprite,
  YypResource,
  type YyDataStrict,
} from '@bscotch/yy';
import { ok } from 'assert';
import { GameMakerProject } from 'extension.project.mjs';
import path from 'path';
import vscode from 'vscode';
import { GmlFile } from './extension.gml.mjs';
import { StitchTreeItemBase } from './extension.tree.mjs';
import { getEventName } from './spec.events.mjs';

export class GameMakerSpriteFrame extends StitchTreeItemBase {
  readonly kind = 'sprite-frame';
  constructor(readonly imagePath: string, readonly idx: number) {
    super(`[${idx}] ${path.basename(imagePath, '.png')}`);
    this.iconPath = vscode.Uri.file(imagePath);
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.iconPath],
    };
  }
}

export class GameMakerResource<
  T extends YyResourceType = YyResourceType,
> extends StitchTreeItemBase {
  readonly kind = 'resource';
  readonly type: T;
  readonly gmlFiles: Map<string, GmlFile> = new Map();
  yy!: YyDataStrict<T>;

  protected constructor(
    readonly project: GameMakerProject,
    readonly resource: YypResource,
  ) {
    super(resource.id.name);
    this.type = resource.id.path.split(/[/\\]/)[0] as T;
    this.id = resource.id.path;
  }

  protected refreshTreeItem() {
    if (this.type !== 'objects') {
      let file: vscode.Uri;
      if (this.type === 'scripts') {
        const gmlFiles = [...this.gmlFiles.values()];
        file = gmlFiles[0]?.uri;
      } else {
        file = vscode.Uri.file(this.yyPath);
      }
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [file],
      };
    }

    this.collapsibleState = ['objects', 'sprites'].includes(this.type)
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.setThemeIcon('question');

    switch (this.type) {
      case 'objects':
        this.setThemeIcon('symbol-misc');
        break;
      case 'rooms':
        this.setGameMakerIcon('room');
        break;
      case 'scripts':
        this.setGameMakerIcon('script');
        break;
      case 'sprites':
        this.setGameMakerIcon('sprite');
        break;
      case 'sounds':
        this.setGameMakerIcon('audio');
        break;
      case 'paths':
        this.setThemeIcon('debug-disconnect');
        break;
      case 'shaders':
        this.setGameMakerIcon('shader');
        break;
      case 'timelines':
        this.setThemeIcon('clock');
        break;
      case 'fonts':
        this.setGameMakerIcon('font');
        break;
      case 'tilesets':
        this.setThemeIcon('layers');
        break;
    }
  }

  get yyFileSymbol(): vscode.SymbolInformation {
    return new vscode.SymbolInformation(
      this.name,
      vscode.SymbolKind.Package,
      `yy-file (${this.type})`,
      new vscode.Location(
        vscode.Uri.file(this.yyPath),
        new vscode.Position(0, 0),
      ),
    );
  }

  workspaceSymbols(): vscode.SymbolInformation[] {
    const symbols: vscode.SymbolInformation[] = [];
    const fileStart = new vscode.Position(0, 0);
    const gmlFiles = [...this.gmlFiles.values()];
    if (this.type === 'scripts') {
      symbols.push(
        new vscode.SymbolInformation(
          this.name,
          vscode.SymbolKind.Module,
          `${this.type}`,
          new vscode.Location(gmlFiles[0].uri, fileStart),
        ),
      );
    } else if (this.type === 'objects') {
      // Need one entry per event
      for (const gmlFile of gmlFiles) {
        symbols.push(
          new vscode.SymbolInformation(
            this.name,
            vscode.SymbolKind.Namespace,
            getEventName(gmlFile.name),
            new vscode.Location(gmlFile.uri, fileStart),
          ),
        );
      }
    }

    // YY files can be useful for many kinds of
    // assets.
    if (!['scripts'].includes(this.type)) {
      symbols.push(this.yyFileSymbol);
    }
    // Include any GML files
    return symbols;
  }

  protected async readYy(): Promise<YyDataStrict<T>> {
    let asPath: Pathy | undefined = pathy(this.yyPath);
    if (!(await asPath.exists())) {
      const filePattern = new RegExp(`${this.name}\\.yy$`, 'i');
      const paths = await pathy(this.dir).listChildren();
      asPath = paths.find((x) => filePattern.test(x.basename));
    }
    ok(asPath, `Could not find a .yy file for ${this.name}`);
    this.yy = await Yy.read(asPath.absolute, this.type);
    return this.yy;
  }

  get yyPath() {
    return path.join(this.project.rootPath, this.resource.id.path);
  }

  get dir() {
    return path.dirname(this.yyPath);
  }

  get name() {
    return this.resource.id.name;
  }

  /** If this is a sprite, the paths to the frames  */
  framePaths(): string[] {
    if (this.type !== 'sprites') {
      return [];
    }
    const yy = this.yy as YySprite;
    return yy.frames.map((frame) => path.join(this.dir, `${frame.name}.png`));
  }

  createDocs() {
    const docs = new vscode.MarkdownString();
    docs.isTrusted = true;
    docs.baseUri = vscode.Uri.file(this.dir);
    docs.supportHtml = true;
    if (this.type === 'sprites') {
      const yy = this.yy as YySprite;
      for (const frame of yy.frames) {
        const framePath = `${frame.name}.png`;
        docs.appendMarkdown(`<img src="${this.name}/${framePath}" />`);
      }
    } else {
      docs.appendMarkdown(`A ${this.type.replace(/s$/, '')} identifier`);
    }
    return docs;
  }

  async createHover() {
    return new vscode.Hover(await this.createDocs());
  }

  get completion() {
    return new vscode.CompletionItem(
      this.name,
      vscode.CompletionItemKind.Constant,
    );
  }

  fileFromPath(file: vscode.Uri | vscode.TextDocument) {
    const uri = file instanceof vscode.Uri ? file : file.uri;
    const fileName = path.basename(uri.fsPath);
    return this.gmlFiles.get(fileName);
  }

  async loadFile(file: vscode.Uri | vscode.TextDocument): Promise<GmlFile> {
    const uri = file instanceof vscode.Uri ? file : file.uri;
    const fileName = path.basename(uri.fsPath);
    const gml = this.gmlFiles.get(fileName) || new GmlFile(this, uri);
    this.gmlFiles.set(fileName, gml);
    await gml.load(file instanceof vscode.Uri ? undefined : file);
    return gml;
  }

  protected async load() {
    const waits: Promise<any>[] = [];
    waits.push(this.readYy());
    (await pathy(this.dir).listChildren()).forEach((p) => {
      if (p.hasExtension('gml')) {
        waits.push(this.loadFile(vscode.Uri.file(p.absolute)));
      }
    });
    await Promise.all(waits);
  }

  static async from<T extends YyResourceType>(
    project: GameMakerProject,
    resource: YypResource,
  ): Promise<GameMakerResource<T> | undefined> {
    const item = new GameMakerResource(project, resource);
    if (!(await pathy(item.yyPath).exists())) {
      return;
    }
    await item.load();
    item.refreshTreeItem();
    return item as any;
  }
}
