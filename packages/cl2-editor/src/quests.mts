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
    const getQuestMotesForStoryline = (storylineId: string) => {
      return this.packed.working
        .listMotesBySchema<Crashlands2.Schemas['cl2_quest']>('cl2_quest')
        .filter((m) => m.data.storyline === storylineId)
        .map((m) => new MoteItem(this.packed, m, element));
    };
    if (!element) {
      const items = this.packed.working
        .listMotesBySchema('cl2_storyline')
        .map((m) => {
          const storyItem = new MoteItem(this.packed, m);
          // Go ahead and add the quests so they'll be in the lookup
          getQuestMotesForStoryline(m.id);
          return storyItem;
        });
      items?.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
      return items;
    } else if (
      element instanceof MoteItem &&
      element.schemaId === 'cl2_storyline'
    ) {
      // Then get all of the Quest motes that are in this storyline
      const questMotes = getQuestMotesForStoryline(element.mote.id);
      questMotes?.sort((a, b) => a.mote.data.order - b.mote.data.order);
      return questMotes;
    }
    return [];
  }

  async rebuild() {
    this._onDidChangeTreeData.fire();
  }

  static register(workspace: CrashlandsWorkspace) {
    const provider = new QuestTreeProvider(workspace);
    provider.view = vscode.window.createTreeView('cl2-stories', {
      treeDataProvider: provider,
    });
    crashlandsEvents.on('mote-name-changed', (event) => {
      console.log('CHANGED MOTE NAME', event);
      void provider.rebuild();
    });
    const subs = [provider.view];

    provider.rebuild();
    return subs;
  }
}

class MoteItem<Data = unknown> extends TreeItemBase<'mote'> {
  override readonly kind = 'mote';
  parent: MoteItem | undefined;
  schema: Bschema;
  document: vscode.TextDocument | undefined;
  /**
   * Map of moteId:item pairs, to allow lookup up a current tree item by its moteId
   */
  static lookup: Map<string, MoteItem> = new Map();

  constructor(
    readonly packed: GameChanger,
    readonly mote: Mote<Data>,
    parent?: MoteItem,
  ) {
    super(packed.working.getMoteName(mote)!);
    MoteItem.lookup.set(mote.id, this);
    this.schema = packed.working.getSchema(mote.schema_id)!;
    this.parent = parent;
    this.collapsibleState = this.isStoryline
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.iconPath = new vscode.ThemeIcon(this.isStoryline ? 'book' : 'note');
    if (this.isQuest) {
      // Make it openable in the editor
      this.resourceUri = vscode.Uri.parse(moteToPath(mote));
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [this.resourceUri],
      };
    }
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
