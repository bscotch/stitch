import { Bschema, Crashlands2, GameChanger, Mote } from '@bscotch/gcdata';
import vscode from 'vscode';
import { crashlandsEvents } from './events.mjs';
import { moteToPath } from './quests.util.mjs';
import { TreeItemBase } from './tree.base.mjs';
import type { CrashlandsWorkspace } from './workspace.mjs';

export type QuestTreeItem = MoteItem;

export class QuestTreeProvider
  implements vscode.TreeDataProvider<QuestTreeItem>
{
  view!: vscode.TreeView<QuestTreeItem>;

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
    return element.parent;
  }
  getChildren(element?: QuestTreeItem): vscode.ProviderResult<QuestTreeItem[]> {
    if (!element) {
      const items = this.storylineMotes
        .map((m) => {
          return MoteItem.lookup.get(m.id);
        })
        .filter(Boolean) as MoteItem<Crashlands2.Schemas['cl2_storyline']>[];
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
        .map(
          (m) =>
            MoteItem.lookup.get(m.id) as MoteItem<
              Crashlands2.Schemas['cl2_quest']
            >,
        )
        .filter(Boolean);
      questMotes?.sort((a, b) => a.mote.data.order - b.mote.data.order);
      return questMotes;
    }
    return [];
  }

  get storylineMotes() {
    return this.packed.working.listMotesBySchema<
      Crashlands2.Schemas['cl2_storyline']
    >('cl2_storyline');
  }

  get questMotes() {
    return this.packed.working.listMotesBySchema<
      Crashlands2.Schemas['cl2_quest']
    >('cl2_quest');
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
        focus: true,
        expand: true,
      });
    });
    const subs = [provider.view];

    provider.rebuild();
    return subs;
  }
}

type MoteItemData =
  | Crashlands2.Schemas['cl2_quest']
  | Crashlands2.Schemas['cl2_storyline'];

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
    this.collapsibleState = this.isStoryline
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.iconPath = new vscode.ThemeIcon(this.isStoryline ? 'book' : 'note');
    if (this.isQuest) {
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
