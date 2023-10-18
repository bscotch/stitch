import { Bschema, Crashlands2, Mote, Packed } from '@bscotch/gcdata';
import vscode from 'vscode';
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
  getChildren(element?: QuestTreeItem): vscode.ProviderResult<QuestTreeItem[]> {
    if (!element) {
      const items = this.packed
        .listMotesBySchema('cl2_storyline')
        .map((m) => new MoteItem(this.packed, m));
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
        .listMotesBySchema<Crashlands2.Schemas['cl2_quest']>('cl2_quest')
        .filter((m) => m.data.storyline === element.mote.id)
        .map((m) => new MoteItem(this.packed, m, element));
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
