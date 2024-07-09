import type {
  Bschema,
  GameChanger,
  Mote,
  QuestData,
  StorylineData,
} from '@bscotch/gcdata';
import vscode from 'vscode';
import { MoteItemData, QuestTreeItem } from './quests.tree.mjs';
import { moteToPath } from './quests.util.mjs';
import { TreeItemBase } from './tree.base.mjs';

export class MoteItem<
  Data extends MoteItemData = MoteItemData,
> extends TreeItemBase<'mote'> {
  override readonly kind = 'mote';
  document: vscode.TextDocument | undefined;

  constructor(
    readonly packed: GameChanger,
    readonly moteId: string,
    readonly parentItem?: QuestTreeItem,
    options?: { hasChildren?: boolean },
  ) {
    super(packed.working.getMoteName(moteId)!);
    this.collapsibleState = options?.hasChildren
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.iconPath = new vscode.ThemeIcon(
      this.isStoryline() ? 'book' : this.isQuest() ? 'note' : 'question',
    );
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

  /**
   * Get the motes leading to this one via 'parent' relationships,
   * in order from most-distant to most-recent ancestor
   */
  get moteHeirarchy(): Mote[] {
    const heirarchy: Mote[] = [];
    let parent: Mote | undefined = this.packed.working.getMote(
      this.mote.parent,
    )!;
    const seen = new Set<string>();
    while (parent) {
      heirarchy.push(parent);
      parent = this.packed.working.getMote(parent.parent);
      // Prevent infinite loops
      if (parent && seen.has(parent.id)) {
        throw new Error(`Mote ${parent.id} is in a circular hierarchy!`);
      } else if (parent) {
        seen.add(parent.id);
      }
    }
    return heirarchy;
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
