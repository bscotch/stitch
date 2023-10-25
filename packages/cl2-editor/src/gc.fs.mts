import { isQuestMote } from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertInternalClaim } from './assert.mjs';
import { crashlandsEvents } from './events.mjs';
import { QuestDocument } from './quests.doc.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class GameChangerFs implements vscode.FileSystemProvider {
  protected getMoteDoc(uri: vscode.Uri): QuestDocument {
    return QuestDocument.from(uri, this.workspace);
  }

  protected getActiveMoteDoc(): QuestDocument | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    const uri = activeEditor.document.uri;
    return this.getMoteDoc(uri);
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const doc = this.getMoteDoc(uri);
    return new Uint8Array(Buffer.from(doc.toString(), 'utf-8'));
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
    const doc = this.getMoteDoc(uri);
    assertInternalClaim(isQuestMote(doc.mote), 'Only quests are supported.');
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

  protected constructor(readonly workspace: CrashlandsWorkspace) {}

  static register(workspace: CrashlandsWorkspace) {
    const provider = new GameChangerFs(workspace);
    crashlandsEvents.on('quest-updated', (uri) => {
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === uri.toString(),
      );
      const moteDoc = provider.getMoteDoc(uri);
      if (!moteDoc) {
        console.warn("Couldn't find mote doc for", uri.toString());
      } else if (doc) {
        moteDoc.parse(doc.getText());
      } else {
        console.warn("Couldn't find doc for", uri.toString());
      }
    });
    return [
      vscode.workspace.registerFileSystemProvider('bschema', provider, {
        isCaseSensitive: true,
        isReadonly: false,
      }),
      vscode.commands.registerCommand(
        'crashlands.quests.enter',
        (mods?: { shift?: boolean }) => {
          const doc = provider.getActiveMoteDoc();
          doc?.onEnter(mods?.shift);
        },
      ),
    ];
  }

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
