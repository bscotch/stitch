import {
  ORDER_INCREMENT,
  type Bschema,
  type GameChanger,
  type Mote,
  type QuestData,
  type StorylineData,
} from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { crashlandsEvents } from './events.mjs';
import { moteToPath } from './quests.util.mjs';
import { TreeItemBase } from './tree.base.mjs';
import type { CrashlandsWorkspace } from './workspace.mjs';

export type QuestTreeItem = MoteItem | FolderItem;
type DropMode = 'order' | 'nest';

export class QuestTreeProvider
  implements vscode.TreeDataProvider<QuestTreeItem>
{
  view!: vscode.TreeView<QuestTreeItem>;
  protected readonly treeMimeType = 'application/vnd.code.tree.cl2-stories';
  readonly dragMimeTypes = [this.treeMimeType];
  readonly dropMimeTypes = [this.treeMimeType];
  protected dropMode: DropMode = 'order';

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
  getParent(element: QuestTreeItem): vscode.ProviderResult<QuestTreeItem> {
    return element.parentItem;
  }
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
          items.push(
            new FolderItem(undefined, undefined, [folder[0]], { open: true }),
          );
          baseFolders.add(folder[0]);
        }
      }
    } else if (item instanceof FolderItem) {
      // For all motes that have the same parent as this folder, add them or their folder base
      for (const mote of motes) {
        const parent = getParent(mote);
        if (parent !== item.parentMote) {
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
            items.push(
              new FolderItem(undefined, item, subfolder, { open: false }),
            );
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
          items.push(
            new FolderItem(parent, item, [moteFolder[0]], { open: false }),
          );
          baseFolders.add(moteFolder[0]);
        } else {
          items.push(
            new MoteItem(this.packed, mote.id, item, {
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

  get storylineAndQuestMotes() {
    return this.packed.working.listMotesBySchema<StorylineData | QuestData>(
      'cl2_storyline',
      'cl2_quest',
    );
  }

  get allMotes() {
    return this.packed.working.listMotes();
  }

  rebuild() {
    // Ensure all motes have a tree item instance
    this._onDidChangeTreeData.fire();
  }

  async setFolder(item: MoteItem) {
    if (!item) return;
    // Figure out what the relative path will be to
    const parent = item.parentMote;
    let currentFolder = item.mote.folder || '';
    if (!parent) {
      currentFolder = `/${currentFolder}/`;
    } else if (currentFolder) {
      currentFolder = `${currentFolder}/`;
    }

    // Prompt for a folder name, with the description showing what the relative path will be to. If we're inside another folder, prefix the path with that folderpath.
    let newFolder = await vscode.window.showInputBox({
      prompt: parent
        ? `Adding relative to ${this.workspace.packed.working.getMoteName(
            parent,
          )}. Prefix with a '/' to add relative to the root.`
        : `Add new root folder relative to the root.`,
      value: currentFolder,
      valueSelection: [currentFolder.length, currentFolder.length],
    });
    if (!newFolder || currentFolder === newFolder) return;
    let fromRoot = !parent;
    if (newFolder.startsWith('/')) {
      fromRoot = true;
      newFolder = newFolder.slice(1);
    }
    // Remove trailing slashes
    newFolder = newFolder.replace(/\/+$/, '');

    this.packed.updateMoteLocation(
      item.moteId,
      fromRoot ? undefined : parent?.id,
      newFolder || undefined,
    );
    await this.packed.writeChanges();
    this.rebuild();
  }

  setDropMode(mode: DropMode) {
    void vscode.commands.executeCommand(
      'setContext',
      'crashlands.dropMode',
      mode,
    );
    this.dropMode = mode;
  }
  handleDrag(
    source: readonly QuestTreeItem[],
    dataTransfer: vscode.DataTransfer,
  ): void | Thenable<void> {
    const item = new vscode.DataTransferItem(source);
    dataTransfer.set(this.treeMimeType, item);
  }
  async handleDrop(
    onto: QuestTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
  ) {
    if (!onto) return;
    const dropping: QuestTreeItem = (dataTransfer.get(this.treeMimeType)
      ?.value || [])[0];
    if (!dropping || dropping === onto) return;

    // Need different outcomes for every combination of target and dropping (each can be a mote or a folder)
    // 1. Dropping a mote onto a mote
    //    a. (order mode) Place it before the target, OR
    //    b. OR (nesting mode) make it a child of the target
    // 2. Dropping a mote onto a folder
    //    - Put the mote into the folder as the last item (children will automatically be moved)
    // 3. Dropping a folder onto a mote
    //    - Move all motes in the folder (recursively) by setting their parent to the target mote and updating their folder to slice the path items up to the dropped folder
    // 4. Dropping a folder onto a folder
    //    - Move all motes in the folder (recursively) by setting their parent to the mote containing the target folder
    const storyAndQuestMotes = this.storylineAndQuestMotes;
    const allMotes = this.allMotes;
    const getChildren = (
      moteId: string | undefined,
      folder: string | undefined,
      includeAllMotes?: boolean,
    ) => {
      const children = (includeAllMotes ? allMotes : storyAndQuestMotes).filter(
        (otherMote) =>
          otherMote.parent === moteId && otherMote.folder === folder,
      );
      return children.sort((a, b) => a.data.order - b.data.order);
    };
    const getSiblings = (mote: Mote | undefined, includeAllMotes?: boolean) =>
      getChildren(mote?.parent, mote?.folder, includeAllMotes);
    const assertIsNotInParents = (
      ofMote: Mote | undefined,
      hopefullyNonParent: Mote,
    ) => {
      if (!ofMote || !hopefullyNonParent) return;
      assertLoudly(
        this.workspace.packed.working
          .getAncestors(ofMote)
          .find((m) => m.id === hopefullyNonParent.id) === undefined,
        "Can't create circular relationships!",
      );
    };

    if (
      onto instanceof MoteItem &&
      dropping instanceof MoteItem &&
      this.dropMode === 'order'
    ) {
      // Case 1.a
      // Then we're dropping a mote onto a mote. That should cause the dropped Mote to
      // have the same parent & folder as the target, and be placed immediately after it.
      // To properly place, we need to know the order of the target and its next sibling
      const targetSiblings = getSiblings(onto.mote);
      const priorSibling = targetSiblings.findLast(
        (sib) =>
          sib.data.order <= onto.mote.data.order &&
          sib.id !== onto.mote.id &&
          sib.id !== dropping.mote.id,
      );
      const newOrder = priorSibling
        ? (priorSibling.data.order + onto.mote.data.order) / 2
        : onto.mote.data.order - ORDER_INCREMENT;
      this.packed.updateMoteData(dropping.moteId, 'data/order', newOrder);
      this.packed.updateMoteLocation(
        dropping.moteId,
        onto.mote.parent,
        onto.mote.folder,
      );
    } else if (
      onto instanceof MoteItem &&
      dropping instanceof MoteItem &&
      this.dropMode === 'nest'
    ) {
      // Case 1.b
      // We need to make the dropped mote a child of the target mote:
      // - Make sure we aren't creating a circularity
      // - Remove its folder value
      // - Set its parent to the target mote
      // - Make it the last child of the target mote
      assertIsNotInParents(onto.mote, dropping.mote);

      const targetSiblings = getSiblings(onto.mote);
      this.packed.updateMoteLocation(dropping.moteId, onto.mote.id, undefined);
      this.packed.updateMoteData(
        dropping.moteId,
        'data/order',
        (targetSiblings.at(-1)?.data.order ?? 0) + ORDER_INCREMENT,
      );
    } else if (dropping instanceof MoteItem && onto instanceof FolderItem) {
      // Case 2
      // Then we're dropping a mote onto a folder.
      // Put the mote into the folder as the *last* item,
      // which requires finding the mote-parent for this folder,
      // setting the drop-mote's parent to that, and its folder
      assertIsNotInParents(onto.parentMote, dropping.mote);
      const targetSiblings = getChildren(
        onto.parentMote?.id,
        onto.relativePathString,
      );
      this.packed.updateMoteLocation(
        dropping.moteId,
        onto.parentMote?.id,
        onto.relativePathString,
      );
      this.packed.updateMoteData(
        dropping.moteId,
        'data/order',
        (targetSiblings.at(-1)?.data.order ?? 0) + ORDER_INCREMENT,
      );
    } else if (dropping instanceof FolderItem && onto instanceof MoteItem) {
      // Case 3
      // Then we're dropping a folder onto a mote.
      // We need to get all motes that are in this folder (no need for recursion since things are all defined relatively)
      // Each mote needs to have its parent set to the target mote, and its folder set to the final part of the folder path
      const motesToMove = getChildren(
        dropping.parentMote?.id,
        dropping.relativePathString,
        true,
      );
      for (const mote of motesToMove) {
        assertIsNotInParents(onto.mote, mote);
        this.packed.updateMoteLocation(
          mote.id,
          onto.mote.id,
          dropping.relativePath.at(-1),
        );
      }
    } else if (onto instanceof FolderItem && dropping instanceof FolderItem) {
      // Case 4
      // Then we're dropping a folder onto a folder.
      // Get all of the motes in this folder
      // For each mote, set its parent to the parent of the target folder, and its folder to the target folder's path + the final part of its own path
      const motesToMove = getChildren(
        dropping.parentMote?.id,
        dropping.relativePathString,
        true,
      );
      for (const mote of motesToMove) {
        assertIsNotInParents(onto.parentMote, mote);
        const folder = mote.folder?.split('/').at(-1);
        this.packed.updateMoteLocation(
          mote.id,
          onto.parentMote?.id,
          onto.relativePathString + (folder ? `/${folder}` : ''),
        );
      }
    } else {
      throw new Error(`Unhandled drop case: ${onto} onto ${dropping}`);
    }

    await this.packed.writeChanges();
    this.rebuild();
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

    // Default the drop-mode to 'order'
    provider.setDropMode('order');

    const subs = [
      vscode.commands.registerCommand(
        'crashlands.tree.dropMode.order.enable',
        () => {
          provider.setDropMode('order');
        },
      ),
      vscode.commands.registerCommand(
        'crashlands.tree.dropMode.nest.enable',
        () => {
          provider.setDropMode('nest');
        },
      ),
      vscode.commands.registerCommand(
        'crashlands.tree.setFolder',
        (item: MoteItem) => {
          if (!(item instanceof MoteItem)) return;
          provider.setFolder(item);
        },
      ),
      vscode.commands.registerCommand(
        'crashlands.tree.copyFolderPath',
        (item: QuestTreeItem) => {
          if (!(item instanceof FolderItem)) return;
          vscode.env.clipboard.writeText(item.relativePathString);
        },
      ),
      provider.view,
    ];

    provider.rebuild();
    return subs;
  }
}

class FolderItem extends TreeItemBase<'folder'> {
  override readonly kind = 'folder';

  constructor(
    /**
     * Folders are defined relative to a parent Mote,
     * or relative to the root if there is no parent.
     */
    readonly parentMote: Mote | undefined,
    readonly parentItem: QuestTreeItem | undefined,
    /**
     * Path to this folder relative to its parent Mote
     * (or the root if there is no parent)
     */
    readonly relativePath: string[],
    options?: { open?: boolean },
  ) {
    super(relativePath.at(-1)!);
    this.contextValue = this.kind;
    this.collapsibleState = options?.open
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed;
    this.iconPath = new vscode.ThemeIcon('folder');
  }

  get relativePathString() {
    return this.relativePath.join('/');
  }
}

type MoteItemData =
  | QuestData
  | StorylineData
  | { id: unknown; schema: unknown; order: number };

class MoteItem<
  Data extends MoteItemData = MoteItemData,
> extends TreeItemBase<'mote'> {
  override readonly kind = 'mote';
  document: vscode.TextDocument | undefined;
  static lookup = new Map<string, MoteItem>();

  constructor(
    readonly packed: GameChanger,
    readonly moteId: string,
    readonly parentItem?: QuestTreeItem,
    options?: { hasChildren?: boolean },
  ) {
    super(packed.working.getMoteName(moteId)!);
    this.contextValue =
      this.kind + '-' + packed.working.getMote(moteId)!.schema_id;
    MoteItem.lookup.set(moteId, this);
    this.collapsibleState = options?.hasChildren
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.iconPath = new vscode.ThemeIcon(
      this.isStoryline() ? 'book' : this.isQuest() ? 'note' : 'question',
    );
    // Make it openable in the editor
    this.resourceUri = vscode.Uri.parse(moteToPath(this.mote));
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.resourceUri],
    };
  }

  get parentMote(): Mote | undefined {
    return this.mote.parent
      ? this.packed.working.getMote(this.mote.parent)
      : undefined;
  }

  /**
   * Get the motes leading to this one via 'parent' relationships,
   * in order from most-distant to most-recent ancestor
   */
  get moteHeirarchy(): Mote[] {
    return this.packed.working.getAncestors(this.mote);
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
