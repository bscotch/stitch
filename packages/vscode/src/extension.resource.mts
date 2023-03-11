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

export class GameMakerResource<
  T extends YyResourceType = YyResourceType,
> extends vscode.TreeItem {
  readonly type: T;
  readonly gmlFiles: Map<string, GmlFile> = new Map();

  protected constructor(
    readonly project: GameMakerProject,
    readonly resource: YypResource,
  ) {
    super(resource.id.name);
    this.type = resource.id.path.split(/[/\\]/)[0] as T;
    this.id = resource.id.path;
  }

  async readYy(): Promise<YyDataStrict<T>> {
    let asPath: Pathy | undefined = pathy(this.yyPath);
    if (!(await asPath.exists())) {
      const filePattern = new RegExp(`${this.name}\\.yy$`, 'i');
      const paths = await pathy(this.dir).listChildren();
      asPath = paths.find((x) => filePattern.test(x.basename));
    }
    ok(asPath, `Could not find a .yy file for ${this.name}`);
    const yy = await Yy.read(asPath.absolute, this.type);
    return yy;
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

  async createDocs() {
    const docs = new vscode.MarkdownString();
    docs.isTrusted = true;
    // @ts-expect-error
    docs.baseUri = vscode.Uri.file(this.dir);
    // @ts-expect-error
    docs.supportHtml = true;
    if (this.type === 'sprites') {
      const yy = (await this.readYy()) as YySprite;
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

  async loadFile(file: vscode.Uri | vscode.TextDocument): Promise<GmlFile> {
    const uri = file instanceof vscode.Uri ? file : file.uri;
    const fileName = path.basename(uri.fsPath);
    const gml = this.gmlFiles.get(fileName) || new GmlFile(this, uri);
    this.gmlFiles.set(fileName, gml);
    await gml.load(file instanceof vscode.Uri ? undefined : file);
    return gml;
  }

  protected async load() {
    (await pathy(this.dir).listChildren()).forEach((p) => {
      if (p.hasExtension('gml')) {
        void this.loadFile(vscode.Uri.file(p.absolute));
      }
    });
  }

  static async from<T extends YyResourceType>(
    project: GameMakerProject,
    resource: YypResource,
  ): Promise<GameMakerResource<T>> {
    const item = new GameMakerResource(project, resource);
    await item.load();
    return item as any;
  }
}
