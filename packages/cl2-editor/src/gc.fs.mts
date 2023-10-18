import { Mote, isQuestMote } from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertInternalClaim } from './assert.mjs';
import { parseGameChangerUri, questToBuffer } from './quests.util.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class GameChangerFs implements vscode.FileSystemProvider {
  protected getMote(uri: vscode.Uri): Mote {
    console.log('Getting mote from path', uri.path);
    const { moteId } = parseGameChangerUri(uri);
    assertInternalClaim(moteId, 'Expected a mote id');
    const mote = this.workspace.packed.getMote(moteId);
    assertInternalClaim(mote, `No mote found with id ${moteId}`);
    return mote;
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const mote = this.getMote(uri);
    assertInternalClaim(isQuestMote(mote), 'Only quests are supported.');
    return questToBuffer(mote, this.workspace.packed);
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

  protected constructor(readonly workspace: CrashlandsWorkspace) {}

  static register(workspace: CrashlandsWorkspace) {
    const provider = new GameChangerFs(workspace);
    return [
      vscode.workspace.registerFileSystemProvider('bschema', provider, {
        isCaseSensitive: true,
        isReadonly: false,
      }),
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
