/**
 * The analyzer: holds a project's files and keeps their analysis, and the
 * project's symbol table, up to date as files change.
 */
import type { FileAnalysis, MemberContribution } from './analysis.types.ts';
import { Checker, type CheckOptions } from './checker.ts';
import {
  declare,
  parseFile,
  type FileDeclarations,
  type ParsedFile,
  type SourceFile,
} from './file.ts';
import type { NativeTable } from './natives.ts';
import {
  ids,
  type ShapeEntry,
  type SymbolKind,
  type SymbolTable,
} from './symbols.ts';
import {
  ProjectTable,
  isEmpty,
  type ChangeSet,
  type FileProvides,
} from './table.ts';

/** An asset in the project */
export interface AssetInfo {
  name: string;
  /** The asset's kind, as in its yy path: `objects`, `sprites`, ... */
  kind: string;
  /** For objects, the parent object's name */
  parent?: string;
  /** For objects, the variables defined in the IDE's object editor */
  variables?: ObjectVariableInfo[];
}

/** An instance variable defined in the object editor (in the object's yy file) */
export interface ObjectVariableInfo {
  name: string;
  /**
   * The yy `varType`: 0 Real, 1 Integer, 2 String, 3 Boolean,
   * 4 Expression, 5 Asset, 6 List, 7 Colour
   */
  varType: number;
  /** The default value, as written in the editor */
  value?: string;
  /** Where it's defined (the yy file's id), for go-to-definition */
  file: string;
}

/** Functions and constants provided by extensions */
export interface ExtensionInfo {
  constants: { name: string; value: string }[];
  functions: {
    name: string;
    externalName: string;
    /** 1 for String, 2 for Real */
    args: number[];
    returnType: number;
    help?: string;
  }[];
}

/** What the analyzer needs to know about the project, besides its code */
export interface ProjectInfo {
  assets: AssetInfo[];
  audioGroups?: string[];
  extensions?: ExtensionInfo[];
}

export interface AnalyzerOptions extends CheckOptions {
  /** Max check passes when settling cross-file inference. @default 6 */
  maxPasses?: number;
}

interface FileState {
  parsed: ParsedFile;
  declarations: FileDeclarations;
  analysis?: FileAnalysis;
}

/** A reference, in the project-wide index */
export interface IndexedReference {
  file: string;
  start: number;
  end: number;
  /** `self`/`other`: refers to the symbol, but not by name */
  keyword?: boolean;
}

export interface AnalyzeResult {
  /** Files that were (re)checked */
  checked: Set<string>;
  passes: number;
}

/** Batches larger than this rebuild the table instead of updating it */
const BULK_UPDATE_THRESHOLD = 50;

export class GmlAnalyzer {
  readonly natives: NativeTable;
  readonly options: AnalyzerOptions;
  protected project: ProjectInfo = { assets: [] };
  protected readonly files = new Map<string, FileState>();
  protected readonly dirty = new Set<string>();
  protected readonly tables: ProjectTable;
  /** Files whose table contributions need updating */
  protected readonly pending = new Set<string>();
  protected projectChanged = false;
  /** Reverse dependency index: dependency key → files */
  protected readonly dependents = new Map<string, Set<string>>();
  protected readonly dependencyKeys = new Map<string, string[]>();

  constructor(natives: NativeTable, options: AnalyzerOptions = {}) {
    this.natives = natives;
    this.options = options;
    this.tables = new ProjectTable(natives);
  }

  /** The current project symbol table (layered over the natives) */
  get table(): SymbolTable {
    return this.tables.table;
  }

  setProject(project: ProjectInfo) {
    this.project = project;
    this.projectChanged = true;
  }

  /** Add or update a file. Call `analyze()` to bring results up to date. */
  setFile(file: SourceFile, text: string) {
    const existing = this.files.get(file.id);
    const parsed = parseFile(file, text);
    if (
      existing &&
      existing.parsed.hash === parsed.hash &&
      sameFile(existing.parsed.file, file)
    ) {
      return;
    }
    this.files.set(file.id, {
      parsed,
      declarations: declare(parsed),
      analysis: existing?.analysis,
    });
    this.dirty.add(file.id);
    // New files contribute their declarations right away
    if (!existing) this.pending.add(file.id);
  }

  removeFile(id: string) {
    if (!this.files.delete(id)) return;
    this.dirty.delete(id);
    this.setDependencies(id, undefined);
    this.pending.add(id);
  }

  getFile(id: string): ParsedFile | undefined {
    return this.files.get(id)?.parsed;
  }

  getAnalysis(id: string): FileAnalysis | undefined {
    return this.files.get(id)?.analysis;
  }

  get fileIds(): string[] {
    return [...this.files.keys()];
  }

  /**
   * Bring all analysis results up to date: check changed files, then
   * re-check whatever depended on what changed, until nothing changes.
   */
  analyze(): AnalyzeResult {
    const checked = new Set<string>();
    const maxPasses = this.options.maxPasses ?? 6;
    this.applyPending();
    let passes = 0;
    while (this.dirty.size && passes < maxPasses) {
      passes++;
      const toCheck = this.checkOrder([...this.dirty]);
      if (toCheck.length > BULK_UPDATE_THRESHOLD) {
        // Many files (e.g. loading a project): check them all against the
        // same table, then rebuild it once
        this.dirty.clear();
        const updates = new Map<string, FileProvides | undefined>();
        for (const id of toCheck) {
          const state = this.check(id);
          if (!state) continue;
          checked.add(id);
          updates.set(id, this.providesOf(id, state));
        }
        this.markDependents(
          this.tables.setFiles(updates, BULK_UPDATE_THRESHOLD),
        );
        continue;
      }
      for (const id of toCheck) {
        // (It may have been checked already this pass, after being dirtied)
        if (!this.dirty.delete(id)) continue;
        const state = this.check(id);
        if (!state) continue;
        checked.add(id);
        // Update the table right away, so later files see the results
        this.markDependents(
          this.tables.setFile(id, this.providesOf(id, state)),
        );
      }
    }
    this.dirty.clear();
    this._refIndex = undefined;
    this._memberNames = undefined;
    return { checked, passes };
  }

  protected check(id: string): FileState | undefined {
    const state = this.files.get(id);
    if (!state) return undefined;
    state.analysis = new Checker(
      state.parsed,
      { project: this.table, natives: this.natives },
      this.options,
    ).check();
    this.setDependencies(id, state.analysis);
    return state;
  }

  /** Apply table changes for files added, removed or re-projected */
  protected applyPending() {
    if (this.projectChanged) {
      this.projectChanged = false;
      for (const id of this.files.keys()) this.pending.add(id);
      this.tables.setProject(this.project);
    }
    if (!this.pending.size) return;
    const updates = new Map<string, FileProvides | undefined>();
    for (const id of this.pending) {
      const state = this.files.get(id);
      updates.set(id, state ? this.providesOf(id, state) : undefined);
    }
    this.pending.clear();
    this.markDependents(this.tables.setFiles(updates, BULK_UPDATE_THRESHOLD));
  }

  /** What a file contributes to the table: its analysis, or its declarations */
  protected providesOf(fileId: string, state: FileState): FileProvides {
    const file = state.parsed.file;
    const createEventOf =
      file.kind === 'objectEvent' && file.event === 'Create_0'
        ? file.asset
        : undefined;
    if (state.analysis) {
      return {
        owned: state.analysis.owned,
        members: state.analysis.members,
        createEventOf,
        callsInherited: state.analysis.callsInherited,
      };
    }
    // Not checked yet: what's known without checking
    const shapes: ShapeEntry[] = [];
    for (const g of state.declarations.globals) {
      if (g.kind !== 'constructor') continue;
      shapes.push({
        id: ids.structShape(g.name),
        kind: 'struct',
        name: g.name,
        symbol: ids.global(g.name),
        parents: g.parent ? [ids.structShape(g.parent)] : [],
        members: new Map(),
      });
    }
    return {
      owned: { shapes, functions: state.declarations.functions, symbols: [] },
      members: seedContributions(fileId, state),
      createEventOf,
      callsInherited: state.declarations.callsInherited,
    };
  }

  //#region Dependencies

  protected setDependencies(
    fileId: string,
    analysis: FileAnalysis | undefined,
  ) {
    for (const key of this.dependencyKeys.get(fileId) ?? []) {
      this.dependents.get(key)?.delete(fileId);
    }
    if (!analysis) {
      this.dependencyKeys.delete(fileId);
      return;
    }
    const keys: string[] = [];
    for (const [shape, names] of analysis.deps.members) {
      keys.push(`shape:${shape}`);
      for (const name of names) keys.push(`member:${shape}\u0000${name}`);
    }
    for (const id of analysis.deps.symbols) keys.push(`symbol:${id}`);
    for (const id of analysis.deps.functions) keys.push(`fn:${id}`);
    for (const key of keys) {
      let files = this.dependents.get(key);
      if (!files) this.dependents.set(key, (files = new Set()));
      files.add(fileId);
    }
    this.dependencyKeys.set(fileId, keys);
  }

  protected markDependents(changes: ChangeSet) {
    if (isEmpty(changes)) return;
    const mark = (key: string) => {
      for (const file of this.dependents.get(key) ?? []) {
        if (this.files.has(file)) this.dirty.add(file);
      }
    };
    for (const [shape, names] of changes.members) {
      // The shape's parents changed: every lookup in it is affected
      if (names.has('*')) {
        mark(`shape:${shape}`);
        continue;
      }
      // Files that listed all members are affected by any change
      mark(`member:${shape}\u0000*`);
      for (const name of names) mark(`member:${shape}\u0000${name}`);
    }
    for (const id of changes.symbols) mark(`symbol:${id}`);
    for (const id of changes.functions) mark(`fn:${id}`);
  }

  //#endregion

  /** Scripts first, then objects (parents before children), then the rest */
  protected checkOrder(fileIds: string[]): string[] {
    const depth = new Map<string, number>();
    const parents = new Map(
      this.project.assets
        .filter((a) => a.kind === 'objects')
        .map((a) => [a.name, a.parent]),
    );
    const depthOf = (name: string): number => {
      if (depth.has(name)) return depth.get(name)!;
      depth.set(name, 0); // cycle guard
      const parent = parents.get(name);
      const d = parent ? depthOf(parent) + 1 : 0;
      depth.set(name, d);
      return d;
    };
    const rank = (id: string) => {
      const file = this.files.get(id)?.parsed.file;
      if (!file) return [9, 0];
      if (file.kind === 'script') return [0, 0];
      if (file.kind === 'objectEvent') {
        return [1, depthOf(file.asset), file.event === 'Create_0' ? 0 : 1];
      }
      return [2, 0];
    };
    return fileIds.sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)];
      for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
        const d = (ra[i] ?? 0) - (rb[i] ?? 0);
        if (d) return d;
      }
      return a.localeCompare(b);
    });
  }

  //#region Project-wide indexes

  protected _memberNames: Set<string> | undefined;

  /**
   * Names declared as members of any object or struct, or assigned on an
   * instance of unknown type (e.g. by a script function, on its caller)
   */
  get declaredMemberNames(): Set<string> {
    if (!this._memberNames) {
      const names = new Set<string>();
      for (const shape of this.table.shapes.values()) {
        if (shape.kind !== 'object' && shape.kind !== 'struct') continue;
        for (const name of shape.members.keys()) names.add(name);
      }
      const prefix = `${ids.instanceBase}/`;
      for (const state of this.files.values()) {
        for (const ref of state.analysis?.refs ?? []) {
          if (ref.write && ref.implicit && ref.symbol.startsWith(prefix)) {
            names.add(ref.symbol.slice(prefix.length));
          }
        }
      }
      this._memberNames = names;
    }
    return this._memberNames;
  }

  protected _refIndex: Map<string, IndexedReference[]> | undefined;

  /** Every reference to every symbol, by symbol id */
  get refIndex() {
    if (!this._refIndex) {
      const index = new Map<string, IndexedReference[]>();
      for (const [file, state] of this.files) {
        for (const ref of state.analysis?.refs ?? []) {
          let list = index.get(ref.symbol);
          if (!list) index.set(ref.symbol, (list = []));
          list.push({
            file,
            start: ref.start,
            end: ref.end,
            keyword: ref.keyword,
          });
        }
      }
      this._refIndex = index;
    }
    return this._refIndex;
  }

  //#endregion
}

function sameFile(a: SourceFile, b: SourceFile): boolean {
  return (
    a.id === b.id &&
    a.kind === b.kind &&
    a.asset === b.asset &&
    a.event === b.event &&
    a.object === b.object
  );
}

/** Contributions from the declarations pass, for files not yet checked */
function seedContributions(
  fileId: string,
  state: FileState,
): MemberContribution[] {
  const result: MemberContribution[] = [];
  const kinds = new Map<string, SymbolKind>([
    ['function', 'function'],
    ['constructor', 'constructor'],
    ['macro', 'macro'],
    ['enum', 'enum'],
    ['globalvar', 'variable'],
    ['globalMember', 'variable'],
    ['docGlobal', 'variable'],
  ]);
  for (const g of state.declarations.globals) {
    const constant = ['function', 'constructor', 'macro', 'enum'].includes(
      g.kind,
    );
    result.push({
      shape: ids.globalShape,
      name: g.name,
      file: fileId,
      start: g.start,
      end: g.end,
      priority: g.kind === 'globalMember' ? (g.assigned ? 1 : 3) : 0,
      kind: kinds.get(g.kind)!,
      writable: constant ? false : undefined,
      mixin: g.mixin,
      inferredType: g.type,
      fn:
        g.kind === 'function' || g.kind === 'constructor'
          ? ids.fn(g.name)
          : undefined,
      shapeRef:
        g.kind === 'enum'
          ? ids.enumShape(g.name)
          : g.kind === 'constructor'
            ? ids.structShape(g.name)
            : undefined,
      declaredType:
        g.kind === 'enum'
          ? [{ kind: 'Enum', name: g.name }]
          : g.kind === 'function' || g.kind === 'constructor'
            ? [{ kind: 'Function', name: g.name }]
            : undefined,
    });
    if (g.kind === 'enum') {
      for (const [idx, member] of (g.members ?? []).entries()) {
        result.push({
          shape: ids.enumShape(g.name),
          name: member.name,
          file: fileId,
          start: member.start,
          end: member.end,
          priority: 0,
          kind: 'enumMember',
          declaredType: [
            { kind: 'EnumMember', name: `${g.name}.${member.name}` },
          ],
          idx,
          writable: false,
        });
      }
    }
  }
  const file = state.parsed.file;
  for (const m of state.declarations.members) {
    const shape =
      m.owner === 'self'
        ? ids.objectShape(file.asset)
        : ids.structShape(m.owner.constructor);
    result.push({
      shape,
      name: m.name,
      file: fileId,
      start: m.start,
      end: m.end,
      priority: m.definitive ? 0 : 1,
      kind: 'variable',
      instance: true,
      static: m.static,
    });
  }
  return result;
}
