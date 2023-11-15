import {
  Bschema,
  Crashlands2,
  GameChanger,
  Mote,
  ORDER_INCREMENT,
} from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { crashlandsEvents } from './events.mjs';
import { moteToPath } from './quests.util.mjs';
import { TreeItemBase } from './tree.base.mjs';
import type { CrashlandsWorkspace } from './workspace.mjs';

export type QuestTreeItem = MoteItem;
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

  handleDrag(
    source: readonly QuestTreeItem[],
    dataTransfer: vscode.DataTransfer,
  ): void | Thenable<void> {
    if (source.length !== 1 || !source[0].isQuest) {
      return;
    }
    const item = new vscode.DataTransferItem(source);
    dataTransfer.set(this.treeMimeType, item);
  }
  async handleDrop(
    target: QuestTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
  ) {
    if (!target) return;
    const dropping = dataTransfer.get(this.treeMimeType)
      ?.value as QuestTreeItem[];
    if (dropping.length !== 1) return;
    const droppingItem = dropping[0] as MoteItem<QuestData>;
    if (!droppingItem.isQuest) return;

    const siblings = this.questMotesInStoryline(
      droppingItem.mote.data.storyline,
    );

    let newOrder: number;

    if (target.isStoryline()) {
      // If the target is a storyline, then we want to:
      // 1. Guarantee that it's the same storyline
      // 2. Move the quest so that it is first in the storyline
      assertLoudly(
        target.moteId === droppingItem.mote.data.storyline,
        "Can't move quests between storylines!",
      );
      if (siblings[0].id === droppingItem.moteId) {
        // Then we're already at the top, so do nothing
        return;
      }
      newOrder = siblings[0].data.order - ORDER_INCREMENT;
    } else if (target.isQuest()) {
      // Else if the target is a quest, then:
      // 1. Guarantee that it's in the same storyline
      // 2. Move the quest so that it is AFTER the target quest
      assertLoudly(
        target.mote.data.storyline === droppingItem.mote.data.storyline,
        "Can't move quests between storylines!",
      );
      const targetOrder = target.mote.data.order;
      const nextSibling = siblings.find(
        (s) => s.id !== droppingItem.moteId && s.data.order > targetOrder,
      );
      newOrder = nextSibling
        ? (nextSibling.data.order + targetOrder) / 2
        : targetOrder + ORDER_INCREMENT;
    } else return;

    // Write the changes and emit a tree change event
    this.packed.updateMoteData(droppingItem.moteId, 'data/order', newOrder);
    await this.packed.writeChanges();
    const storyItem = MoteItem.lookup.get(droppingItem.mote.data.storyline);
    this._onDidChangeTreeData.fire(storyItem);
  }

  getTreeItem(element: QuestTreeItem): QuestTreeItem {
    return element;
  }
  getParent(element: QuestTreeItem): vscode.ProviderResult<QuestTreeItem> {
    return element.parent;
  }
  getChildren(element?: QuestTreeItem): vscode.ProviderResult<QuestTreeItem[]> {
    if (!element) {
      const items = this.storylineMotes
        .map((m) => {
          return MoteItem.lookup.get(m.id);
        })
        .filter(Boolean) as MoteItem<StorylineData>[];
      items?.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
      return items;
    } else if (
      element instanceof MoteItem &&
      element.schemaId === 'cl2_storyline'
    ) {
      // Then get all of the Quest motes that are in this storyline
      const questMotes = this.questMotes
        .filter((m) => m.data.storyline === element.moteId)
        .map((m) => MoteItem.lookup.get(m.id) as MoteItem<QuestData>)
        .filter(Boolean);
      questMotes?.sort((a, b) => a.mote.data.order - b.mote.data.order);
      return questMotes;
    }
    return [];
  }

  get storylineMotes() {
    return this.packed.working.listMotesBySchema<StorylineData>(
      'cl2_storyline',
    );
  }

  get questMotes() {
    return this.packed.working.listMotesBySchema<QuestData>('cl2_quest');
  }

  /** Get the quests in a storyline, in order by their data/order field */
  questMotesInStoryline(storylineId: string) {
    const quests = this.questMotes.filter(
      (m) => m.data.storyline === storylineId,
    );
    quests.sort((a, b) => a.data.order - b.data.order);
    return quests;
  }

  rebuild() {
    // Ensure all motes have a tree item instance

    this.storylineMotes.forEach((storylineMote) => {
      const storyItem =
        MoteItem.lookup.get(storylineMote.id) ||
        new MoteItem(this.packed, storylineMote.id);
      // Add the story's quests
      this.questMotes
        .filter((questMote) => questMote.data.storyline === storylineMote.id)
        .forEach(
          (questMote) =>
            MoteItem.lookup.get(questMote.id) ||
            new MoteItem(this.packed, questMote.id, storyItem),
        );
    });

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

type MoteItemData = QuestData | StorylineData;

class MoteItem<
  Data extends MoteItemData = MoteItemData,
> extends TreeItemBase<'mote'> {
  override readonly kind = 'mote';
  parent: MoteItem | undefined;
  document: vscode.TextDocument | undefined;
  /**
   * Map of moteId:item pairs, to allow lookup up a current tree item by its moteId
   */
  static lookup: Map<string, MoteItem> = new Map();

  constructor(
    readonly packed: GameChanger,
    readonly moteId: string,
    parent?: MoteItem,
  ) {
    super(packed.working.getMoteName(moteId)!);
    MoteItem.lookup.set(moteId, this);
    this.parent = parent;
    this.collapsibleState = this.isStoryline()
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
