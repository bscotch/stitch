import { pathy } from '@bscotch/pathy';
import { homedir } from 'os';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { ComfortDocument } from './comfort.doc.mjs';
import { crashlandsConfig } from './config.mjs';
import { crashlandsEvents } from './events.mjs';
import type { Backup, BackupsIndex } from './gc.fs.types.mjs';
import { QuestDocument } from './quests.doc.mjs';
import { isComfortUri, isQuestUri, isStorylineUri } from './quests.util.mjs';
import { StorylineDocument } from './storyline.doc.mjs';
import { computeChecksum } from './utility.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class GameChangerFs implements vscode.FileSystemProvider {
  static get backupsDir() {
    return pathy('.stitch/cl2-editor/backups', homedir());
  }
  protected backups: BackupsIndex | undefined;
  protected debouncedParses = new Map<string, NodeJS.Timeout>();

  protected getMoteDoc(
    uri: vscode.Uri,
  ): QuestDocument | StorylineDocument | ComfortDocument {
    if (isQuestUri(uri)) {
      return QuestDocument.from(uri, this.workspace);
    } else if (isStorylineUri(uri)) {
      return StorylineDocument.from(uri, this.workspace);
    } else if (isComfortUri(uri)) {
      return ComfortDocument.from(uri, this.workspace);
    }
    throw new Error('Unknown uri type: ' + uri.toString());
  }

  protected getActiveMoteDoc():
    | QuestDocument
    | StorylineDocument
    | StorylineDocument
    | undefined {
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
  async writeFile(uri: vscode.Uri, content: Uint8Array) {
    const doc = this.getMoteDoc(uri);
    if (doc.parseResults?.diagnostics.length !== 0) {
      throw new Error('Cannot save until issues are resolved.');
    }
    await doc.save(content.toString());
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

  async updateBackupLastOpened(moteId: string, checksum: string) {
    const backups = this.backups?.motes?.[moteId];
    if (!backups) {
      return;
    }
    const backup = backups.find((b) => b.checksum === checksum);
    if (!backup) {
      return;
    }
    backup.lastOpened = Date.now();
    await this.saveBackupsIndex();
  }

  async listBackups(moteId: string) {
    const backups = this.backups?.motes?.[moteId];
    if (!backups) {
      return [];
    }
    const backupsInfo =
      backups.map((b) => ({
        schemaId: b.schema,
        moteId,
        created: new Date(b.date),
        lastOpened: new Date(b.lastOpened || b.date),
        checksum: b.checksum,
        filePath: GameChangerFs.backupsDir.join(
          moteId,
          `${b.checksum}.${b.schema}`,
        ),
      })) || [];
    const exist = await Promise.all(
      backupsInfo.map((b) => b.filePath.exists()),
    );
    // Clean up missing backups
    for (let i = backups.length - 1; i >= 0; i--) {
      if (exist[i]) continue;
      backupsInfo.splice(i, 1);
    }
    return backupsInfo
      .filter((_, i) => exist[i])
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  protected async loadBackupsIndex() {
    await GameChangerFs.backupsDir.ensureDir();
    const indexFile = GameChangerFs.backupsDir.join<BackupsIndex>('index.json');
    this.backups = await indexFile.read({ fallback: { motes: {} } });
    // TODO: prune old backups
    // TODO: merge backups that have the same checksum
    const backupsByChecksum = new Map<string, Backup>();
    const backedUpMoteIds = Object.keys(this.backups?.motes || {});
    for (const moteId of backedUpMoteIds) {
      const backups = this.backups!.motes[moteId] || [];
      for (let i = backups.length - 1; i >= 0; i--) {
        const backup = backups[i];
        const checksum = `${backup.schema}.${backup.checksum}`;
        const existing = backupsByChecksum.get(checksum);
        if (!existing) {
          backupsByChecksum.set(checksum, backup);
          continue;
        }
        if (existing.lastOpened < backup.lastOpened) {
          existing.lastOpened = backup.lastOpened;
        }
        backups.splice(i, 1);
      }
    }
    await this.saveBackupsIndex();
  }
  protected async saveBackupsIndex() {
    assertLoudly(
      this.backups,
      'Could not save backups index. Index not loaded.',
    );
    const indexFile = GameChangerFs.backupsDir.join<BackupsIndex>('index.json');
    await indexFile.write(this.backups);
  }

  protected saveBackupCalls = new Map<string, NodeJS.Timeout>();
  createBackup(moteId: string, schemaId: string, content: string) {
    clearTimeout(this.saveBackupCalls.get(moteId));
    this.saveBackupCalls.set(
      moteId,
      setTimeout(async () => {
        this.saveBackupCalls.delete(moteId);
        const dir = GameChangerFs.backupsDir.join(moteId);
        await dir.ensureDir();
        assertLoudly(
          this.backups,
          'Could not create backup! Backups index not loaded.',
        );
        const checksum = computeChecksum(content).slice(0, 8);
        await dir
          .join(`${checksum}.${schemaId}`)
          .write(content, { serialize: false });
        this.backups.motes[moteId] ||= [];
        // Does the backup already exist?
        const backupIndex = this.backups.motes[moteId].findIndex(
          (b) => b.schema === schemaId && b.checksum === checksum,
        );
        if (backupIndex > -1) {
          const backup = this.backups.motes[moteId][backupIndex];
          backup.lastOpened = Date.now();
        } else {
          this.backups.motes[moteId].push({
            schema: schemaId,
            date: Date.now(),
            lastOpened: Date.now(),
            checksum,
          });
          await this.saveBackupsIndex();
        }
      }, crashlandsConfig.backupDelay),
    );
  }

  protected constructor(readonly workspace: CrashlandsWorkspace) {}

  static register(workspace: CrashlandsWorkspace) {
    const provider = new GameChangerFs(workspace);

    crashlandsEvents.on('mote-updated', (uri) => {
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === uri.toString(),
      );
      const moteDoc = provider.getMoteDoc(uri);
      if (!moteDoc) {
        console.warn("Couldn't find mote doc for", uri.toString());
      } else if (doc) {
        clearTimeout(provider.debouncedParses.get(uri.toString()));
        provider.debouncedParses.set(
          uri.toString(),
          setTimeout(() => {
            const text = doc.getText();
            moteDoc.parse(text);
            if (!moteDoc.parseResults?.diagnostics.length) {
              // Create a backup
              provider.createBackup(
                moteDoc.mote.id,
                moteDoc.mote.schema_id,
                text,
              );
            }
          }, crashlandsConfig.parseDelay),
        );
      } else {
        console.warn("Couldn't find doc for", uri.toString());
      }
    });
    provider.loadBackupsIndex();
    return [
      vscode.workspace.registerFileSystemProvider('bschema', provider, {
        isCaseSensitive: true,
        isReadonly: false,
      }),
      vscode.commands.registerCommand(
        'crashlands.quests.enter',
        (mods?: { shift?: boolean }) => {
          const doc = provider.getActiveMoteDoc();
          if (doc instanceof QuestDocument) {
            doc?.onEnter(mods?.shift);
          }
        },
      ),
      vscode.commands.registerCommand(
        'crashlands.editor.backup.restore',
        async () => {
          const uri = vscode.window.activeTextEditor?.document.uri;
          if (!uri) {
            return;
          }
          const moteDoc = provider.getMoteDoc(uri);
          const backups = await provider.listBackups(moteDoc.mote.id);
          assertLoudly(backups.length, 'No backups found.');

          const backup = await vscode.window.showQuickPick(
            backups.map((b) => ({
              label: `Created: ${b.created.toLocaleString()} | Restored: ${b.lastOpened.toLocaleString()}`,
              moteId: b.moteId,
              checksum: b.checksum,
              filePath: b.filePath,
            })),
            {
              placeHolder: 'Select a backup to restore',
            },
          );
          if (!backup) {
            return;
          }
          const content = (await backup.filePath.read({
            parse: false,
          })) as string;
          let edit = new vscode.WorkspaceEdit();
          let range = moteDoc.document?.validateRange(
            new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE),
          );
          assertLoudly(
            range,
            'Could not replace the document with the backup.',
          );
          edit.replace(moteDoc.uri, range, content);
          vscode.workspace.applyEdit(edit);
          await provider.updateBackupLastOpened(backup.moteId, backup.checksum);
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
