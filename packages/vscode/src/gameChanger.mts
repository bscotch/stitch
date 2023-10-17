import {
  Bschema,
  Crashlands2,
  Mote,
  Packed,
  isQuestMote,
} from '@bscotch/gcdata';
import vscode, { type TreeItem } from 'vscode';
import { assertInternalClaim } from './assert.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import {
  moteToPath,
  parseGameChangerUri,
  questToBuffer,
} from './gameChanger.util.mjs';
import { createSorter } from './lib.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';

class GameChangerFs implements vscode.FileSystemProvider {
  protected getMote(uri: vscode.Uri): Mote {
    console.log('Getting mote from path', uri.path);
    const { moteId } = parseGameChangerUri(uri);
    assertInternalClaim(moteId, 'Expected a mote id');
    const mote = this.tree.packed?.getMote(moteId);
    assertInternalClaim(mote, `No mote found with id ${moteId}`);
    return mote;
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const mote = this.getMote(uri);
    assertInternalClaim(isQuestMote(mote), 'Only quests are supported.');
    return questToBuffer(mote, this.tree.packed!);
  }

  stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
    // TODO: Cache what's been statted, so we can tell if the version has
    // been changed.
    return {
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0,
    };
  }
  readDirectory(
    uri: vscode.Uri,
  ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    console.log('readDirectory', uri);
    throw new Error('Readdir not implemented.');
  }
  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    throw new Error('CreateDir not implemented.');
  }
  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean },
  ): void | Thenable<void> {
    throw new Error('WriteFile not implemented.');
  }
  delete(
    uri: vscode.Uri,
    options: { readonly recursive: boolean },
  ): void | Thenable<void> {
    throw new Error('Delete not implemented.');
  }
  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { readonly overwrite: boolean },
  ): void | Thenable<void> {
    throw new Error('Rename not implemented.');
  }
  watch(): vscode.Disposable {
    // ignore, fires for all changes...
    return new vscode.Disposable(() => {});
  }

  constructor(readonly tree: GameChangerTreeProvider) {}

  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  onDidChangeFile = this._emitter.event;
  private _bufferedEvents: vscode.FileChangeEvent[] = [];
  private _fireSoonHandle?: NodeJS.Timeout;
  private _fireSoon(...events: vscode.FileChangeEvent[]): void {
    this._bufferedEvents.push(...events);

    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle);
    }

    this._fireSoonHandle = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 5);
  }
}

class GameChangerFoldProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(
    document: vscode.TextDocument,
    context: vscode.FoldingContext,
  ): vscode.ProviderResult<vscode.FoldingRange[]> {
    return [];
  }
}

export type GameChangerTreeItem = TreeItem;

export class GameChangerTreeProvider
  implements vscode.TreeDataProvider<GameChangerTreeItem>
{
  view!: vscode.TreeView<GameChangerTreeItem>;
  packed: Packed | undefined;
  protected project: GameMakerProject | undefined;
  protected fs: GameChangerFs;

  private _onDidChangeTreeData: vscode.EventEmitter<
    GameChangerTreeItem | undefined | null | void
  > = new vscode.EventEmitter<GameChangerTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidCollapseElement: vscode.EventEmitter<
    GameChangerTreeItem | undefined | null | void
  > = new vscode.EventEmitter<GameChangerTreeItem | undefined | null | void>();
  readonly onDidCollapseElement = this._onDidCollapseElement.event;

  protected constructor(readonly workspace: StitchWorkspace) {
    this.fs = new GameChangerFs(this);
  }

  getTreeItem(element: GameChangerTreeItem): GameChangerTreeItem {
    return element;
  }
  getChildren(
    element?: GameChangerTreeItem,
  ): vscode.ProviderResult<GameChangerTreeItem[]> {
    if (!element) {
      const items = this.packed
        ?.listMotesBySchema('cl2_storyline')
        .map((m) => new MoteItem(this.packed!, m));
      items?.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
      return items;
    } else if (
      element instanceof MoteItem &&
      element.schemaId === 'cl2_storyline'
    ) {
      // Then get all of the Quest motes that are in this storyline
      const questMotes = this.packed
        ?.listMotesBySchema<Crashlands2.Schemas['cl2_quest']>('cl2_quest')
        .filter((m) => m.data.storyline === element.mote.id)
        .map((m) => new MoteItem(this.packed!, m, element));
      questMotes?.sort(createSorter({ sortByField: 'name' }));
      return questMotes;
    }
    return [];
  }

  async rebuild() {
    // This is only really applicable to Crashlands 2, so we just need
    // need to find the first project that has a packed.json file.
    const projects = this.workspace.projects;
    const packedFiles = await Promise.all(
      projects.map((p) => Packed.from(p.yypPath)),
    );
    this.project = undefined;
    this.packed = undefined;
    for (let i = 0; i < projects.length; i++) {
      if (packedFiles[i]) {
        this.project = projects[i];
        this.packed = packedFiles[i];
        break;
      }
    }
    if (this.packed) {
      // TODO: Discover and create GC folders containing storylines
    }

    this._onDidChangeTreeData.fire();
  }

  static register(workspace: StitchWorkspace) {
    const provider = new GameChangerTreeProvider(workspace);
    provider.view = vscode.window.createTreeView('bscotch-stitch-gamechanger', {
      treeDataProvider: provider,
    });
    const subs = [
      provider.view,
      vscode.workspace.registerFileSystemProvider('bschema', provider.fs, {
        isCaseSensitive: true,
        isReadonly: false,
      }),
      vscode.languages.registerFoldingRangeProvider(
        {
          pattern: '**/*.cl2_quest',
        },
        new GameChangerFoldProvider(),
      ),
    ];

    provider.rebuild();
    return subs;
  }
}

class MoteItem<Data = unknown> extends StitchTreeItemBase<'mote'> {
  override readonly kind = 'mote';
  parent: MoteItem | undefined;
  schema: Bschema;
  document: vscode.TextDocument | undefined;

  constructor(
    readonly packed: Packed,
    readonly mote: Mote<Data>,
    parent?: MoteItem,
  ) {
    super(packed.getMoteName(mote));
    this.schema = packed.getSchema(mote.schema_id);
    this.parent = parent;
    this.collapsibleState = this.isStoryline
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.setBaseIcon(this.isStoryline ? 'book' : 'note');
    if (this.isQuest) {
      // Make it openable in the editor
      this.resourceUri = vscode.Uri.parse(moteToPath(mote, packed));
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [this.resourceUri],
      };
    }
  }

  get name(): string {
    return this.packed.getMoteName(this.mote);
  }

  get isStoryline(): boolean {
    return this.mote.schema_id === 'cl2_storyline';
  }

  get isQuest(): boolean {
    return this.mote.schema_id === 'cl2_quest';
  }

  get schemaId(): string {
    return this.mote.schema_id;
  }
}
