import { Bschema, Crashlands2, GameChanger, Mote } from '@bscotch/gcdata';
import vscode from 'vscode';
import { crashlandsEvents } from './events.mjs';
import { moteToPath } from './quests.util.mjs';
import { TreeItemBase } from './tree.base.mjs';
import type { CrashlandsWorkspace } from './workspace.mjs';

export type QuestTreeItem = MoteItem | FolderItem;
type QuestData = Crashlands2.Schemas['cl2_quest'];
type StorylineData = Crashlands2.Schemas['cl2_storyline'];

export class QuestTreeProvider
  implements vscode.TreeDataProvider<QuestTreeItem>
{
  view!: vscode.TreeView<QuestTreeItem>;
  protected readonly treeMimeType = 'application/vnd.code.tree.cl2-stories';
  readonly dragMimeTypes = [this.treeMimeType];
  readonly dropMimeTypes = [this.treeMimeType];

  get packed() {
    return this.workspace.packed;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    QuestTreeItem | undefined | null | void
  > = new vscode.EventEmitter<QuestTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidCollapseElement: vscode.EventEmitter<
    QuestTreeItem | undefined | null | void
  > = new vscode.EventEmitter<QuestTreeItem | undefined | null | void>();
  readonly onDidCollapseElement = this._onDidCollapseElement.event;

  protected constructor(readonly workspace: CrashlandsWorkspace) {}

  getTreeItem(element: QuestTreeItem): QuestTreeItem {
    return element;
  }
  // getParent(element: QuestTreeItem): vscode.ProviderResult<QuestTreeItem> {
  //   return element.parent;
  // }
  getChildren(item?: QuestTreeItem): vscode.ProviderResult<QuestTreeItem[]> {
    const motes = this.storylineAndQuestMotes;
    const items: QuestTreeItem[] = [];
    const baseFolders = new Set<string>();
    const getParent = (mote: Mote) =>
      mote.parent ? this.packed.working.getMote(mote.parent)! : undefined;
    const getFolder = (mote: Mote) =>
      mote.folder ? mote.folder.split('/') : [];

    // Make sure we know if a mote has children, so
    // it can be displayed with a folder toggle etc
    const hasChildren = new Map<Mote, Mote[]>();
    for (const mote of motes) {
      const parent = getParent(mote);
      if (parent) {
        hasChildren.set(parent, (hasChildren.get(parent) || []).concat(mote));
      }
    }

    if (!item) {
      // For each mote, add it (if no folder OR parent) or its root folder (if folder but no parent)
      for (const mote of motes) {
        const parent = getParent(mote);
        const folder = getFolder(mote);
        if (!parent && !folder.length) {
          // Then this is a root-level mote
          items.push(
            new MoteItem(this.packed, mote.id, undefined, {
              hasChildren: !!hasChildren.get(mote),
            }),
          );
        } else if (!parent && folder.length && !baseFolders.has(folder[0])) {
          items.push(new FolderItem(undefined, [folder[0]], { open: true }));
          baseFolders.add(folder[0]);
        }
      }
    } else if (item instanceof FolderItem) {
      // For all motes that have the same parent as this folder, add them or their folder base
      for (const mote of motes) {
        const parent = getParent(mote);
        if (parent !== item.parent) {
          continue;
        }
        // Is this mote in this or a deeper folder?
        const moteFolder = getFolder(mote);
        let isInFolder = true;
        for (let i = 0; i < item.relativePath.length; i++) {
          if (item.relativePath[i] === moteFolder[i]) {
            continue;
          } else {
            isInFolder = false;
            break;
          }
        }
        // Is this mote *directly* in this folder?
        if (isInFolder && moteFolder.length === item.relativePath.length) {
          items.push(
            new MoteItem(this.packed, mote.id, undefined, {
              hasChildren: !!hasChildren.get(mote),
            }),
          );
        }
        // Is this mote in a subfolder of this folder?
        else if (isInFolder) {
          // Then add the subfolder
          const subfolder = moteFolder.slice(0, item.relativePath.length + 1);
          if (!baseFolders.has(subfolder.at(-1)!)) {
            items.push(new FolderItem(undefined, subfolder, { open: false }));
            baseFolders.add(subfolder.at(-1)!);
          }
        }
      }
    } else if (item instanceof MoteItem) {
      // Then find all motes that have this one as their parent. If they have a folder, add the folder base. If they don't, add them directly.
      for (const mote of motes) {
        const parent = getParent(mote);
        if (parent !== item.mote) {
          continue;
        }
        const moteFolder = getFolder(mote);
        if (moteFolder.length && !baseFolders.has(moteFolder[0])) {
          // Then add the subfolder
          items.push(new FolderItem(parent, [moteFolder[0]], { open: false }));
          baseFolders.add(moteFolder[0]);
        } else {
          items.push(
            new MoteItem(this.packed, mote.id, parent, {
              hasChildren: !!hasChildren.get(mote),
            }),
          );
        }
      }
    }
    // Sort items by:
    // 1. Folders first, in alphabetical order
    // 2. Motes second, in order of their order property
    return items.sort((a, b) => {
      const aName = (a.label as string).toLowerCase();
      const bName = (b.label as string).toLowerCase();
      if (a instanceof FolderItem && b instanceof FolderItem) {
        return aName.localeCompare(bName);
      } else if (a instanceof FolderItem) {
        return -1;
      } else if (b instanceof FolderItem) {
        return 1;
      }
      const aData = a.mote.data as any;
      const bData = b.mote.data as any;
      if ('order' in aData && 'order' in bData) {
        return aData.order - bData.order;
      } else if ('order' in aData) {
        return -1;
      } else if ('order' in bData) {
        return 1;
      }
      // Otherwise, sort by name
      return aName.localeCompare(bName);
    });
  }

  get storylineAndQuestMotes(): Mote<
    Crashlands2.Quest | Crashlands2.Storyline,
    string
  >[] {
    return this.packed.working.listMotesBySchema<StorylineData | QuestData>(
      'cl2_storyline',
      'cl2_quest',
    );
  }

  rebuild() {
    // Ensure all motes have a tree item instance
    this._onDidChangeTreeData.fire();
  }

  static register(workspace: CrashlandsWorkspace) {
    const provider = new QuestTreeProvider(workspace);
    provider.view = vscode.window.createTreeView('cl2-stories', {
      treeDataProvider: provider,
      dragAndDropController: provider,
    });
    crashlandsEvents.on('mote-name-changed', (event) => {
      void provider.rebuild();
    });
    crashlandsEvents.on('quest-opened', (uri, info) => {
      // Reveal the quest in the tree
      const questItem = MoteItem.lookup.get(info.moteId!);
      if (!questItem) {
        console.log("Couldn't find tree item for quest", info.moteId);
        return;
      }
      provider.view.reveal(questItem, {
        expand: true,
      });
    });
    const subs = [provider.view];

    provider.rebuild();
    return subs;
  }
}

class FolderItem extends TreeItemBase<'folder'> {
  override readonly kind = 'folder';
  static lookup = new Map<Mote | undefined, Map<string, FolderItem>>();
  static getFolder(parent: Mote | undefined, relativePath: string[]) {
    return FolderItem.lookup.get(parent)?.get(relativePath.join('/'));
  }

  constructor(
    /**
     * Folders are defined relative to a parent Mote,
     * or relative to the root if there is no parent.
     */
    readonly parent: Mote | undefined,
    /**
     * Path to this folder relative to its parent Mote
     * (or the root if there is no parent)
     */
    readonly relativePath: string[],
    options?: { open?: boolean },
  ) {
    super(relativePath.at(-1)!);
    this.collapsibleState = options?.open
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed;
    this.iconPath = new vscode.ThemeIcon('folder');
    FolderItem.lookup.set(parent, FolderItem.lookup.get(parent) || new Map());
    FolderItem.lookup.get(parent)!.set(relativePath.join('/'), this);
  }
}

type MoteItemData = QuestData | StorylineData;

class MoteItem<
  Data extends MoteItemData = MoteItemData,
> extends TreeItemBase<'mote'> {
  override readonly kind = 'mote';
  document: vscode.TextDocument | undefined;
  /**
   * Map of moteId:item pairs, to allow lookup up a current tree item by its moteId
   */
  static lookup: Map<string, MoteItem> = new Map();

  constructor(
    readonly packed: GameChanger,
    readonly moteId: string,
    readonly parent?: Mote,
    options?: { hasChildren?: boolean },
  ) {
    super(packed.working.getMoteName(moteId)!);
    MoteItem.lookup.set(moteId, this);
    this.collapsibleState = options?.hasChildren
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.iconPath = new vscode.ThemeIcon(this.isStoryline() ? 'book' : 'note');
    if (this.isQuest()) {
      // Make it openable in the editor
      this.resourceUri = vscode.Uri.parse(moteToPath(this.mote));
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [this.resourceUri],
      };
    }
  }

  get schema(): Bschema {
    return this.packed.working.getSchema(this.mote.schema_id)!;
  }

  get mote(): Mote<Data> {
    return this.packed.working.getMote(this.moteId)! as Mote<Data>;
  }

  get name(): string {
    return this.packed.working.getMoteName(this.mote)!;
  }

  isStoryline(): this is MoteItem<StorylineData> {
    return this.mote.schema_id === 'cl2_storyline';
  }

  isQuest(): this is MoteItem<QuestData> {
    return this.mote.schema_id === 'cl2_quest';
  }

  get schemaId(): string {
    return this.mote.schema_id;
  }
}
