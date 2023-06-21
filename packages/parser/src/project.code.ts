import type { Pathy } from '@bscotch/pathy';
import { parser, type GmlParsed } from './parser.js';
import type { Asset } from './project.asset.js';
import {
  Diagnostic,
  DiagnosticCollectionName,
  DiagnosticCollections,
} from './project.diagnostics.js';
import {
  FunctionArgRange,
  LinePosition,
  Position,
  Range,
  Reference,
  ReferenceableType,
  Scope,
} from './project.location.js';
import type { Symbol } from './project.symbol.js';
import { processGlobalSymbols } from './project.visitGlobals.js';
import { Type, TypeMember } from './types.js';
import { assert, isBeforeRange, isInRange } from './util.js';
import { processSymbols } from './visitor.js';

/** Represenation of a GML code file. */
export class Code {
  readonly $tag = 'gmlFile';
  readonly scopes: Scope[] = [];

  protected diagnostics!: DiagnosticCollections;
  /** List of all symbol references in this file, in order of appearance. */
  protected _refs: Reference[] = [];
  /** Ranges representing function call arguments,
   * in order of appearance. Useful for signature help. */
  protected _functionArgRanges: FunctionArgRange[] = [];
  /** List of function calls, where each root item is a list
   * of argument ranges for that call. Useful for diagnostics.*/
  protected _functionCalls: FunctionArgRange[][] = [];
  protected _refsAreSorted = false;
  _content!: string;
  protected _parsed!: GmlParsed;

  // Metadata
  /** For object events, whether or not `event_inherited` is unambiguously being called */
  public callsSuper = false;

  constructor(readonly asset: Asset, readonly path: Pathy<string>) {
    this.clearAllDiagnostics();
  }

  /** When set to `true`, this file will be flagged for reprocessing. */
  set dirty(value: boolean) {
    if (value) {
      this.project.addDirtyCode(this);
    }
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

  get startPosition() {
    return Position.fromFileStart(this);
  }

  /** A zero-length range at the start of the file. */
  get startRange() {
    return new Range(this.startPosition, this.startPosition);
  }

  protected isInRange(
    range: { start: Position; end: Position },
    offset: number | LinePosition,
  ) {
    return isInRange(range, offset);
  }

  protected isBeforeRange(range: Range, offset: number | LinePosition) {
    return isBeforeRange(range, offset);
  }

  getReferenceAt(offset: number): Reference | undefined;
  getReferenceAt(position: LinePosition): Reference | undefined;
  getReferenceAt(line: number, column: number): Reference | undefined;
  getReferenceAt(
    offset: number | LinePosition,
    column?: number,
  ): Reference | undefined {
    if (typeof offset === 'number' && typeof column === 'number') {
      offset = { line: offset, column };
    }
    assert(this.refs, 'Refs must be an array');
    for (let i = 0; i < this.refs.length; i++) {
      const ref = this.refs[i];
      if (this.isInRange(ref, offset)) {
        return ref;
      } else if (this.isBeforeRange(ref, offset)) {
        return undefined;
      }
    }
    return undefined;
  }

  getFunctionArgRangeAt(
    offset: number | LinePosition,
    column?: number,
  ): FunctionArgRange | undefined {
    if (typeof offset === 'number' && typeof column === 'number') {
      offset = { line: offset, column };
    }
    let match: FunctionArgRange | undefined;
    const ranges = this.functionArgRanges;
    assert(ranges, 'Function arg ranges must be an array');
    for (let i = 0; i < ranges.length; i++) {
      const argRange = ranges[i];
      if (this.isInRange(argRange, offset)) {
        // These could be nested, so an outer arg range might contain an inner one.
        // Since these are sorted by start offset, we can return the *last* one to ensure that we're in the innermost range.
        match = argRange;
        continue;
      } else if (this.isBeforeRange(argRange, offset)) {
        return match;
      }
    }
    return match;
  }

  getScopeRangeAt(
    offset: number | LinePosition,
    column?: number,
  ): Scope | undefined {
    if (typeof offset === 'number' && typeof column === 'number') {
      offset = { line: offset, column };
    }
    for (const scopeRange of this.scopes) {
      if (this.isInRange(scopeRange, offset)) {
        return scopeRange;
      }
    }
    // Default to the last scope,
    // since we can end up with wonkiness with EOF trailing whitespace
    return this.scopes.at(-1);
  }

  getInScopeSymbolsAt(
    offset: number | LinePosition,
    column?: number,
  ): (Symbol | TypeMember)[] {
    if (typeof offset === 'number' && typeof column === 'number') {
      offset = { line: offset, column };
    }
    const scopeRange = this.getScopeRangeAt(offset);
    if (!scopeRange) {
      return [];
    }
    if (scopeRange.isDotAccessor) {
      // Then only return self variables
      return scopeRange.self.listMembers() || [];
    }
    return [
      // Local variables
      ...(scopeRange.local.listMembers() || []),
      // Self variables, if not global
      ...((scopeRange.self !== this.project.self
        ? scopeRange.self.listMembers()
        : []) || []),
      // Project globals
      ...this.project.symbols.values(),
      ...(this.project.self.listMembers() || []),
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

  get functionArgRanges() {
    if (!this._refsAreSorted) {
      this.sortRefs();
      this._refsAreSorted = true;
    }
    return [...this._functionArgRanges];
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
    this.clearAllDiagnostics();
    this._content =
      typeof content === 'string' ? content : await this.path.read();
    this._parsed = parser.parse(this.content);
    for (const diagnostic of this._parsed.errors) {
      const fromToken = isNaN(diagnostic.token.startOffset)
        ? diagnostic.previousToken
        : diagnostic.token;
      this.diagnostics.SYNTAX_ERROR.push(
        Diagnostic.error(
          diagnostic.message,
          Range.fromCst(this, fromToken || diagnostic.token),
          diagnostic,
        ),
      );
    }
  }

  protected clearAllDiagnostics() {
    this.diagnostics = {
      MISSING_EVENT_INHERITED: [],
      SYNTAX_ERROR: [],
      UNDECLARED_VARIABLE_REFERENCE: [],
      TOO_MANY_ARGUMENTS: [],
      MISSING_REQUIRED_ARGUMENT: [],
      GLOBAl_SELF: [],
      JSDOC_MISMATCH: [],
      INVALID_OPERATION: [],
    };
  }

  addDiagnostic(collection: DiagnosticCollectionName, diagnostic: Diagnostic) {
    this.diagnostics[collection].push(diagnostic);
  }

  addRef(ref: Reference) {
    this._refs.push(ref);
  }

  addFunctionArgRange(range: FunctionArgRange) {
    this._functionArgRanges.push(range);
  }

  addFunctionCall(call: FunctionArgRange[]) {
    this._functionCalls.push(call);
  }

  sortRefs() {
    interface Offset {
      start: { offset: number };
    }
    const sorter = (a: Offset, b: Offset) => {
      assert(a, 'Ref a does not exist');
      assert(b, 'Ref b does not exist');
      assert(a.start && b.start, 'Ref does not have a start');
      return a.start.offset - b.start.offset;
    };
    this._refs.sort(sorter);
    this._functionArgRanges.sort(sorter);
  }

  protected initializeScopeRanges() {
    assert(this.scopes, 'Scopes must be initialized');
    this.scopes.length = 0;
    const position = Position.fromFileStart(this);
    const self = this.asset.instanceType || this.project.self;
    const local = new Type('Struct');
    this.scopes.push(new Scope(position, local, self));
  }

  reset() {
    this.initializeScopeRanges();
    // Remove each reference in *this file* from its symbol.
    const cleared = new Set<ReferenceableType>();
    for (const ref of this._refs) {
      const symbol = ref.item;
      if (cleared.has(symbol) || !symbol.refs.size) {
        continue;
      }
      const isDefinedInThisFile = this === symbol.def?.file;
      // If the symbol was declared in this file, remove its location
      if (isDefinedInThisFile) {
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
    this._functionArgRanges = [];
    this._functionCalls = [];
    this._refsAreSorted = false;
  }

  onRemove() {
    this.reset();
  }

  /**
   * Reprocess after a modification to the file. Optionally
   * provide new content to use instead of reading from disk.
   */
  async reload(content?: string, options?: { reloadDirty?: boolean }) {
    this._content = content || this._content;
    await this.parse(this._content);
    this.updateGlobals();
    this.updateAllSymbols();
    this.updateDiagnostics();
    // TODO: Update everything that ended up dirty due to the changes
    if (options?.reloadDirty) {
      await this.project.reloadDirtyCode();
    }
  }

  protected discoverEventInheritanceWarnings() {
    this.diagnostics.MISSING_EVENT_INHERITED = [];
    if (
      this.asset.assetType !== 'objects' ||
      !this.isCreateEvent ||
      !this.asset.parent
    ) {
      return;
    }
    // Then the type will have been set up to inherit from the parent.
    // BUT. If this event does not call `event_inherited()`, then we
    // need to unlink the type.
    if (!this.callsSuper) {
      this.asset.instanceType!.parent = undefined;
      this.diagnostics.MISSING_EVENT_INHERITED.push({
        $tag: 'diagnostic',
        message: `Event does not call \`event_inherited()\`, so it will not inherit from its parent.`,
        severity: 'warning',
        location: this.startRange,
      });
    } else {
      // Ensure that the type is set as the parent by re-assigning it.
      // eslint-disable-next-line no-self-assign
      this.asset.parent = this.asset.parent;
    }
  }

  protected computeFunctionCallDiagnostics() {
    // Look through the function call ranges to see if we have too many or too few arguments.
    assert(this._functionCalls, 'Function calls must be initialized');
    this.diagnostics.MISSING_REQUIRED_ARGUMENT = [];
    this.diagnostics.TOO_MANY_ARGUMENTS = [];

    calls: for (let i = 0; i < this._functionCalls.length; i++) {
      const args = this._functionCalls[i];
      assert(args, 'Function call args must be initialized');
      assert(args[0], 'Function call must have a function');
      const func = args[0].type;
      const params = func.listParameters() || [];
      const ref = args[0].ref;
      // Handle missing arguments
      for (let j = 0; j < params.length; j++) {
        const param = params[j];
        const arg = args[j] as FunctionArgRange | undefined;
        const argIsEmpty = !arg?.hasExpression;
        if (!param.optional && argIsEmpty) {
          this.diagnostics.MISSING_REQUIRED_ARGUMENT.push(
            Diagnostic.error(
              `Missing required argument \`${param.name}\` for function \`${func.name}\`.`,
              arg || ref,
            ),
          );
          // There may be more missing args but
          // that just starts to get noisy.
          continue calls;
        }
      }
      if (params.at(-1)?.name === '...') {
        // Then we can't have too many arguments
        continue;
      }
      if (!params.length && args.length === 1 && !args[0].hasExpression) {
        // Then this is a zero-arg function and we aren't providing any args.
        continue;
      }
      // Handle extra arguments.
      for (let j = params.length; j < args.length; j++) {
        const arg = args[j];
        this.diagnostics.TOO_MANY_ARGUMENTS.push(
          Diagnostic.warn(`Extra argument for function \`${func.name}\`.`, arg),
        );
      }
    }
  }

  updateGlobals() {
    this.reset();
    return processGlobalSymbols(this);
  }

  updateAllSymbols() {
    processSymbols(this);
  }

  updateDiagnostics() {
    this.discoverEventInheritanceWarnings();
    this.computeFunctionCallDiagnostics();
    const diagnostics: Diagnostic[] = [];
    for (const items of Object.values(this.diagnostics)) {
      diagnostics.push(...items);
    }
    if (diagnostics.length) {
      this.project.emitDiagnostics(diagnostics);
    }
  }
}
