import type { Pathy } from '@bscotch/pathy';
import { ok } from 'node:assert';
import { parser, type GmlParsed } from './parser.js';
import type { Asset } from './project.asset.js';
import { Diagnostic } from './project.diagnostics.js';
import {
  Position,
  Range,
  Reference,
  ReferenceableType,
  Scope,
} from './project.location.js';
import { PrimitiveName } from './project.primitives.js';
import type { Symbol } from './project.symbol.js';
import { Type, TypeMember, type StructType } from './project.type.js';
import { processGlobalSymbols } from './project.visitGlobals.js';
import { processSymbols } from './project.visitLocals.js';

/** Represenation of a GML code file. */
export class Code {
  readonly $tag = 'gmlFile';
  readonly scopes: Scope[] = [];
  /** List of all symbol references in this file, in order of appearance. */
  protected _refs: Reference[] = [];
  protected _refsAreSorted = false;
  protected _content!: string;
  protected _parsed!: GmlParsed;

  constructor(readonly asset: Asset, readonly path: Pathy<string>) {
    this.initializeScopeRanges();
  }

  get isScript() {
    return this.asset.assetType === 'scripts';
  }

  get isObjectEvent() {
    return this.asset.assetType === 'objects';
  }

  get isCreateEvent() {
    return this.name === 'Create_0';
  }

  get project() {
    return this.asset.project;
  }

  createType<T extends PrimitiveName>(type: T): Type<T> {
    const baseType = this.project.native.types.get(type) as Type<T>;
    ok(baseType, `Unknown type '${type}'`);
    return baseType!.derive();
  }

  createStructType(): StructType {
    const type = this.createType('Struct') as StructType;
    return type;
  }

  getReferenceAt(offset: number): Reference | undefined {
    for (let i = 0; i < this.refs.length; i++) {
      const ref = this.refs[i];
      if (ref.start.offset <= offset && ref.end.offset >= offset) {
        return ref;
      } else if (ref.start.offset > offset) {
        return undefined;
      }
    }
    return undefined;
  }

  getScopeRangeAt(offset: number): Scope | undefined {
    for (const scopeRange of this.scopes) {
      if (offset >= scopeRange.start.offset) {
        if (!scopeRange.end || offset <= scopeRange.end.offset) {
          return scopeRange;
        }
      }
    }
    return undefined;
  }

  getInScopeSymbolsAt(offset: number): (Symbol | TypeMember)[] {
    const scopeRange = this.getScopeRangeAt(offset);
    if (!scopeRange) {
      return [];
    }
    return [
      // Local variables
      ...(scopeRange.local.members || []),
      // Self variables, if not global
      ...((scopeRange.self !== this.project.self
        ? scopeRange.self.members
        : []) || []),
      // Project globals
      ...(this.project.self.members || []),
      // GML globals
      ...[...this.project.native.global.values()],
    ];
  }

  get refs() {
    if (!this._refsAreSorted) {
      this.sortRefs();
      this._refsAreSorted = true;
    }
    return [...this._refs];
  }

  get name() {
    return this.path.name;
  }

  get basename() {
    return this.path.basename;
  }

  get content() {
    return this._content;
  }

  get cst() {
    return this._parsed.cst;
  }

  /**
   * Load the file and parse it, resulting in an updated
   * CST for future steps. If content is directly provided,
   * it will be used instead of reading from disk. This
   * is useful for editors that want to provide a live preview.
   */
  async parse(content?: string) {
    this._content =
      typeof content === 'string' ? content : await this.path.read();
    this._parsed = parser.parse(this.content);
    const diagnostics: Diagnostic[] = [];
    for (const diagnostic of this._parsed.errors) {
      diagnostics.push({
        type: 'diagnostic',
        kind: 'parser',
        message: diagnostic.message,
        severity: 'error',
        info: diagnostic,
        location: Range.fromCst(this, diagnostic.token),
      });
    }
    if (diagnostics.length) {
      this.project.emitDiagnostics(diagnostics);
    }
  }

  addRef(ref: Reference) {
    this._refs.push(ref);
  }

  sortRefs() {
    this._refs.sort((a, b) => a.start.offset - b.start.offset);
  }

  protected initializeScopeRanges() {
    this.scopes.length = 0;
    const position = Position.fromFileStart(this);
    const self = this.asset.instanceType || this.project.self;
    const local = new Type('Struct');
    this.scopes.push(new Scope(position, local, self));
  }

  clearRefs() {
    this.initializeScopeRanges();
    // Remove each reference in *this file* from its symbol.
    const cleared = new Set<ReferenceableType>();
    for (const ref of this._refs) {
      const symbol = ref.item;
      if (cleared.has(symbol) || !symbol.refs.size) {
        continue;
      }
      const isInThisFile = symbol.def?.file && this === symbol.def.file;
      // If the symbol was declared in this file, remove its location
      if (isInThisFile) {
        symbol.def = undefined;
      }
      // Remove all references to this symbol found in this file
      for (const symbolRef of symbol.refs) {
        if (this === symbolRef.file) {
          symbol.refs.delete(symbolRef);
        }
      }
      cleared.add(symbol);
    }
    // Reset this file's refs list
    this._refs = [];
    this._refsAreSorted = false;
  }

  onRemove() {
    this.clearRefs();
  }

  /**
   * Reprocess after a modification to the file. Optionally
   * provide new content to use instead of reading from disk.
   */
  async reload(content?: string) {
    await this.parse(content);
    this.clearRefs();
    this.updateGlobals();
    this.updateAllSymbols();
  }

  updateGlobals() {
    return processGlobalSymbols(this);
  }

  updateAllSymbols() {
    return processSymbols(this);
  }
}
