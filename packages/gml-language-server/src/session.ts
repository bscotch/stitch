/**
 * A loaded project: a read-only view of its files (kept up to date from disk
 * and from the editor's open documents) and their analysis.
 *
 * The session never writes to the project. Clients change the project
 * themselves, and the session follows the resulting file changes.
 */
import { GameMakerProject } from '@bscotch/gamemaker-project';
import {
  fallbackGmlSpecPath,
  GmlAnalyzer,
  GmlQueries,
  listSourceFiles,
  NativeTable,
  projectInfo,
  readGmlSpec,
  type AnalyzeResult,
  type SourceFile,
} from '@bscotch/gml-parser';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface SessionOptions {
  /** `GmlSpec.xml` files (default: the bundled spec) */
  specs?: string[];
  autoDeclareGlobalsPrefixes?: string[];
  /** The text of a file that is open in the editor, if it is open */
  openText?: (file: string) => string | undefined;
  /** Called when the project reports a problem (e.g. an unreadable file) */
  onError?: (error: Error) => void;
  /** Called after file changes are noticed, so the host can schedule an {@link ProjectSession.update} */
  onDirty?: () => void;
}

export interface UpdateResult extends AnalyzeResult {
  /** Files whose text or metadata were updated */
  touched: Set<string>;
  /** Files that are no longer part of the project */
  removed: string[];
}

function sameSourceFile(a: SourceFile, b: SourceFile): boolean {
  return (
    a.id === b.id &&
    a.kind === b.kind &&
    a.asset === b.asset &&
    a.event === b.event &&
    a.object === b.object
  );
}

const toPosix = (p: string) => p.split(path.sep).join('/');

export class ProjectSession {
  readonly project: GameMakerProject;
  readonly analyzer: GmlAnalyzer;
  readonly queries: GmlQueries;
  readonly options: SessionOptions;
  /** The project's GML files, by lower-cased id */
  protected sourceFiles = new Map<string, SourceFile>();
  protected structureDirty = false;
  protected readonly dirtyFiles = new Set<string>();
  protected queue: Promise<unknown> = Promise.resolve();
  protected readonly unsubscribe: (() => void)[] = [];

  protected constructor(
    project: GameMakerProject,
    analyzer: GmlAnalyzer,
    options: SessionOptions,
  ) {
    this.project = project;
    this.analyzer = analyzer;
    this.queries = new GmlQueries(analyzer);
    this.options = options;
  }

  /** Load a project and analyze all of its GML files */
  static async open(
    yypPath: string,
    options: SessionOptions = {},
  ): Promise<ProjectSession> {
    const specSources = options.specs?.length
      ? options.specs
      : [fallbackGmlSpecPath];
    const [project, specs] = await Promise.all([
      GameMakerProject.open(yypPath),
      Promise.all(specSources.map((s) => readGmlSpec(s))),
    ]);
    const analyzer = new GmlAnalyzer(new NativeTable(specs), {
      autoDeclareGlobalsPrefixes: options.autoDeclareGlobalsPrefixes,
    });
    const session = new ProjectSession(project, analyzer, options);
    session.listen();
    session.structureDirty = true;
    await session.update();
    return session;
  }

  /** Stop following the project's changes */
  dispose() {
    for (const off of this.unsubscribe.splice(0)) off();
  }

  protected listen() {
    const structural = () => {
      this.structureDirty = true;
      this.options.onDirty?.();
    };
    this.unsubscribe.push(
      this.project.on('assetAdded', structural),
      this.project.on('assetRemoved', structural),
      this.project.on('assetChanged', structural),
      this.project.on('yypChanged', structural),
      this.project.on('gmlChanged', (_asset, file) => this.markDirty(file)),
      this.project.on('error', (err) => this.options.onError?.(err)),
    );
  }

  //#region Files

  /** The id of a project GML file, given its absolute path */
  fileIdOf(file: string): string | undefined {
    const relative = toPosix(path.relative(this.project.dir, file));
    return this.sourceFiles.get(relative.toLowerCase())?.id;
  }

  /** The absolute path of a file, given its id (or any project-relative path) */
  pathOf(fileId: string): string {
    return path.join(this.project.dir, fileId);
  }

  sourceFile(fileId: string): SourceFile | undefined {
    return this.sourceFiles.get(fileId.toLowerCase());
  }

  get fileIds(): string[] {
    return [...this.sourceFiles.values()].map((f) => f.id);
  }

  /**
   * Note that a file's content may have changed (on disk, or in the editor).
   * Accepts an absolute path. Call {@link update} to re-analyze.
   */
  markDirty(file: string) {
    const id = this.fileIdOf(file);
    if (!id) return;
    this.dirtyFiles.add(id);
    this.options.onDirty?.();
  }

  /** Whether an open document's text differs from what was analyzed */
  isStale(fileId: string): boolean {
    const open = this.options.openText?.(this.pathOf(fileId));
    return open !== undefined && open !== this.analyzer.getFile(fileId)?.text;
  }

  get hasPendingChanges(): boolean {
    return this.structureDirty || this.dirtyFiles.size > 0;
  }

  protected async readText(fileId: string): Promise<string> {
    const file = this.pathOf(fileId);
    const open = this.options.openText?.(file);
    if (open !== undefined) return open;
    try {
      return await fs.readFile(file, 'utf8');
    } catch {
      // Listed in a yy file but missing on disk
      return '';
    }
  }

  //#endregion

  /**
   * Bring the analysis up to date with every change noted so far. Updates
   * run one at a time; concurrent calls wait their turn.
   */
  update(): Promise<UpdateResult> {
    const run = this.queue.then(() => this.updateNow());
    this.queue = run.catch(() => undefined);
    return run;
  }

  protected async updateNow(): Promise<UpdateResult> {
    const touched = new Set<string>();
    const removed: string[] = [];
    if (this.structureDirty) {
      this.structureDirty = false;
      this.analyzer.setProject(projectInfo(this.project));
      const next = new Map(
        listSourceFiles(this.project).map((f) => [f.id.toLowerCase(), f]),
      );
      for (const [key, file] of this.sourceFiles) {
        const replacement = next.get(key);
        if (!replacement || replacement.id !== file.id) {
          this.analyzer.removeFile(file.id);
          removed.push(file.id);
        }
      }
      for (const [key, file] of next) {
        const previous = this.sourceFiles.get(key);
        if (!previous || !sameSourceFile(previous, file)) {
          this.dirtyFiles.add(file.id);
        }
      }
      this.sourceFiles = next;
    }
    const dirty = [...this.dirtyFiles];
    this.dirtyFiles.clear();
    const texts = await mapConcurrent(dirty, 64, (id) => this.readText(id));
    dirty.forEach((id, i) => {
      const file = this.sourceFile(id);
      if (!file) return;
      this.analyzer.setFile(file, texts[i]);
      touched.add(file.id);
    });
    const result = this.analyzer.analyze();
    return { ...result, touched, removed };
  }
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}
