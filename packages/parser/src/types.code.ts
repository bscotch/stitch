import type { Pathy } from '@bscotch/pathy';
import { parser, type GmlParsed } from './parser.js';
import type { Asset } from './types.asset.js';
import { Diagnostic } from './types.legacy.js';
import {
  Position,
  Reference,
  ReferenceableType,
  Scope,
} from './types.location.js';
import { PrimitiveName } from './types.primitives.js';
import type { Symbol } from './types.symbol.js';
import { Type, type StructType } from './types.type.js';
import { processGlobalSymbols } from './types.visitGlobals.js';
import { processSymbols } from './types.visitLocals.js';

export class GmlFile {
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
    const baseType = (this.project.native.types.get(type) ||
      this.project.native.types.get('Unknown')) as Type<T>;
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

  getInScopeSymbolsAt(offset: number): Symbol[] {
    const scopeRange = this.getScopeRangeAt(offset);
    if (!scopeRange) {
      return [];
    }
    return [
      // ...scopeRange.local.symbols.values(), // Local
      // ...(self.kind !== 'global' ? self.symbols.values() : []), // Self (if not global)
      // ...this.project.self.symbols.values(), // Project globals
      // ...this.project.self.gml.values(), // GML globals
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
        location: {
          file: this.path.absolute,
          startColumn: diagnostic.token.startColumn!,
          startLine: diagnostic.token.startLine!,
          startOffset: diagnostic.token.startOffset!,
          endColumn: diagnostic.token.endColumn!,
          endLine: diagnostic.token.endLine!,
          endOffset: diagnostic.token.endOffset!,
        },
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
    const position = new Position(this, 0, 0, 0);
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
