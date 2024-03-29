import type { Pathy } from '@bscotch/pathy';
import { sequential } from '@bscotch/utility';
import { YyObject } from '@bscotch/yy';
import MagicString from 'magic-string';
import type { JsdocSummary } from './jsdoc.js';
import { ObjectEvent, getEventFromFilename } from './lib.objects.js';
import { logger } from './logger.js';
import { parser, type GmlParsed } from './parser.js';
import type { Asset } from './project.asset.js';
import {
  Diagnostic,
  DiagnosticCollectionName,
  DiagnosticCollections,
} from './project.diagnostics.js';
import {
  FunctionArgRange,
  IPosition,
  IRange,
  LinePosition,
  Position,
  Range,
  Reference,
  ReferenceableType,
  Scope,
  StructNewMemberRange,
} from './project.location.js';
import type { Signifier } from './signifiers.js';
import { getTypeOfKind } from './types.checks.js';
import { Type, type StructType } from './types.js';
import { assert, isBeforeRange, isInRange } from './util.js';
import { registerGlobals } from './visitor.globals.js';
import { registerSignifiers } from './visitor.js';

/** Represenation of a GML code file. */
export class Code {
  readonly $tag = 'gmlFile';
  readonly scopes: Scope[] = [];
  readonly jsdocs: JsdocSummary[] = [];

  protected diagnostics!: DiagnosticCollections;
  /** List of all symbol references in this file, in order of appearance. */
  protected _refs: Reference[] = [];
  /** Ranges representing function call arguments,
   * in order of appearance. Useful for signature help. */
  protected _functionArgRanges: FunctionArgRange[] = [];
  /** Ranges representing locations where new struct
   * members could be added. Useful for autocomplete. */
  protected _structNewMemberRanges: StructNewMemberRange[] = [];
  /** List of function calls, where each root item is a list
   * of argument ranges for that call. Useful for diagnostics.*/
  protected _functionCalls: FunctionArgRange[][] = [];
  protected _rangesAreSorted = false;
  content!: string;
  protected _parsed!: GmlParsed;

  // Metadata
  /** For object events, whether or not `event_inherited` is unambiguously being called */
  public callsSuper = false;

  constructor(
    readonly asset: Asset,
    readonly path: Pathy<string>,
  ) {
    this.clearAllDiagnostics();
  }

  /**
   * If this is the Create event for an object, that object's
   * variables. Else undefined. Used for determining the initial
   * "definitive self" during code processing.
   */
  get definitiveSelf(): StructType | undefined {
    if (this.isCreateEvent) {
      return this.asset.variables;
    }
    return;
  }

  /** When set to `true`, this file will be flagged for reprocessing. */
  set dirty(value: boolean) {
    if (value) {
      this.project.queueDirtyFileUpdate(this);
    }
  }

  get isScript() {
    return this.asset.assetKind === 'scripts';
  }

  get isObjectEvent() {
    return this.asset.assetKind === 'objects';
  }

  get isCreateEvent() {
    return this.name === 'Create_0';
  }

  get isStepEvent() {
    return this.name.startsWith('Step_');
  }

  get project() {
    return this.asset.project;
  }

  get startPosition() {
    return Position.fromFileStart(this);
  }

  /**
   * If this is an object event and Stitch knows about
   * its type, return the info about that event.
   */
  get objectEventInfo(): ObjectEvent | undefined {
    if (!this.isObjectEvent) return undefined;
    return getEventFromFilename(this.path.absolute);
  }

  /** A zero-length range at the start of the file. */
  get startRange() {
    return new Range(this.startPosition, this.startPosition);
  }

  protected isInRange(
    range: { start: IPosition; end: IPosition },
    offset: number | LinePosition,
  ) {
    return isInRange(range, offset);
  }

  protected isBeforeRange(range: IRange, offset: number | LinePosition) {
    return isBeforeRange(range, offset);
  }

  getTextAt(offsetStart: number, offsetEnd: number): string {
    return this.content.slice(offsetStart, offsetEnd + 1);
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

  getJsdocAt(
    offset: number | LinePosition,
    column?: number,
  ): JsdocSummary | undefined {
    if (typeof offset === 'number' && typeof column === 'number') {
      offset = { line: offset, column };
    }
    assert(this.jsdocs, 'Jsdocs must be an array');
    for (let i = 0; i < this.jsdocs.length; i++) {
      const jsdoc = this.jsdocs[i];
      if (this.isInRange(jsdoc, offset)) {
        return jsdoc;
      } else if (this.isBeforeRange(jsdoc, offset)) {
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

  getStructNewMemberRangeAt(
    offset: number | LinePosition,
    column?: number,
  ): StructNewMemberRange | undefined {
    if (typeof offset === 'number' && typeof column === 'number') {
      offset = { line: offset, column };
    }
    const ranges = this.structNewMemberRanges;
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      if (this.isInRange(range, offset)) {
        return range;
      } else if (this.isBeforeRange(range, offset)) {
        return undefined;
      }
    }
    return undefined;
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
  ): Signifier[] {
    if (typeof offset === 'number' && typeof column === 'number') {
      offset = { line: offset, column };
    }
    const scopeRange = this.getScopeRangeAt(offset);
    if (!scopeRange) {
      return [];
    }
    if (scopeRange.isDotAccessor) {
      // Then only return self variables
      // Filter out those that cannot be dot-accessed on global
      // (native functions, etc.)
      if (scopeRange.self === this.project.self) {
        return this.project.self.listMembers().filter((x) => {
          // Only stuff defined in the project could appear as an autocomplete
          const definedInProject = !x.native && !!x.def?.file;
          const canLiveOnGlobal = !x.macro && !getTypeOfKind(x, ['Enum']);
          return definedInProject && canLiveOnGlobal;
        });
      } else {
        return scopeRange.self.listMembers().filter((x) => x.def || x.native);
      }
    }
    // Add to a flat list, and remove all entries that don't have
    // a definition if they are not native
    const allSignifiers = [
      // Local variables
      ...(scopeRange.local.listMembers() || []),
      // Self variables, if not global
      ...((scopeRange.self !== this.project.self
        ? scopeRange.self.listMembers()
        : []) || []),
      // Project globals
      ...(this.project.self.listMembers() || []),
    ];

    // Signifiers were added in order of precedence, so we can remove
    // non-uniques by just keeping the first one we find.
    const uniqueSignifiers = new Map<string, Signifier>();
    for (const signifier of allSignifiers) {
      if (
        !uniqueSignifiers.has(signifier.name) &&
        (signifier.def || signifier.native)
      ) {
        uniqueSignifiers.set(signifier.name, signifier);
      }
    }

    return [...uniqueSignifiers.values()];
  }

  getDiagnostics() {
    return { ...this.diagnostics };
  }

  get refs() {
    this.sortRanges();
    return [...this._refs];
  }

  get functionArgRanges() {
    this.sortRanges();
    return [...this._functionArgRanges];
  }

  get structNewMemberRanges() {
    this.sortRanges();
    return [...this._structNewMemberRanges];
  }

  get name() {
    return this.path.name;
  }

  get basename() {
    return this.path.basename;
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
    this.content =
      typeof content === 'string' ? content : await this.path.read();
    this._parsed = parser.parse(this.content);
    for (const diagnostic of this._parsed.errors) {
      const fromToken = isNaN(diagnostic.token.startOffset)
        ? diagnostic.previousToken
        : diagnostic.token;
      logger.debug(
        'SYNTAX ERROR',
        diagnostic?.message,
        this.path?.absolute,
        fromToken,
      );
      this.diagnostics.SYNTAX_ERROR.push(
        Diagnostic.error(
          diagnostic.message,
          Range.fromCst(this, fromToken || diagnostic.token),
          diagnostic,
        ),
      );
    }
  }

  /**
   * Replace all refs for a signifier with a new name,
   * followed by fully reprocessing the file.
   */
  @sequential
  async renameSignifier(signifier: Signifier, newName: string) {
    const renameableRefs = this.refs.filter(
      (ref) => ref.item === signifier && ref.isRenameable,
    );
    // Rename using magic-string so we don't have to track changed positions
    const updated = new MagicString(this.content);
    for (const ref of renameableRefs) {
      updated.update(
        ref.start.offset,
        ref.end.offset + 1,
        ref.toRenamed(newName),
      );
    }
    // Save to disk and reprocess
    this.content = updated.toString();
    await this.path.write(this.content);
    await this.reload(this.content);
  }

  clearDiagnosticCollection(collection: DiagnosticCollectionName) {
    this.diagnostics[collection] = [];
  }

  protected clearAllDiagnostics() {
    this.diagnostics = {
      GLOBAL_SELF: [],
      INVALID_OPERATION: [],
      JSDOC_MISMATCH: [],
      MISSING_EVENT_INHERITED: [],
      MISSING_REQUIRED_ARGUMENT: [],
      SYNTAX_ERROR: [],
      TOO_MANY_ARGUMENTS: [],
      UNDECLARED_GLOBAL_REFERENCE: [],
      UNDECLARED_VARIABLE_REFERENCE: [],
      JSDOC: [],
      UNUSED: [],
    };
  }

  addDiagnostic(collection: DiagnosticCollectionName, diagnostic: Diagnostic) {
    this.diagnostics[collection].push(diagnostic);
  }

  addRef(ref: Reference) {
    this._refs.push(ref);
  }

  addStructNewMemberRange(range: StructNewMemberRange) {
    this._structNewMemberRanges.push(range);
  }

  addFunctionArgRange(range: FunctionArgRange) {
    this._functionArgRanges.push(range);
  }

  addFunctionCall(call: FunctionArgRange[]) {
    this._functionCalls.push(call);
  }

  protected sortRanges() {
    if (this._rangesAreSorted) return;
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
    this._structNewMemberRanges.sort(sorter);
    this._rangesAreSorted = true;
  }

  protected initializeScopeRanges() {
    const self = this.asset.variables || this.project.self;
    // Re-use the root local scope if it exists
    const local = this.scopes[0]?.local || new Type('Struct');
    this.scopes.length = 0;
    this.jsdocs.length = 0;
    const position = Position.fromFileStart(this);
    this.scopes.push(new Scope(position, local, self));
  }

  protected reset() {
    this.initializeScopeRanges();
    // Remove each reference in *this file* from its symbol.
    const cleared = new Set<ReferenceableType>();
    for (const ref of this._refs) {
      const signifier = ref.item;
      if (cleared.has(signifier)) {
        continue;
      }
      // If the symbol was declared in this file, remove its location
      // to flag it as undeclared.
      const isDefinedInThisFile = this === signifier.def?.file;
      if (isDefinedInThisFile) {
        signifier.unsetDef();
      }
      // Remove all references to this symbol found in this file.
      // Flag all other files as being dirty so they get reprocessed.
      for (const symbolRef of signifier.refs) {
        if (this === symbolRef.file) {
          signifier.refs.delete(symbolRef);
        } else {
          symbolRef.file.dirty = true;
        }
      }
      cleared.add(signifier);
    }
    // Reset this file's refs list
    this._refs = [];
    this._functionArgRanges = [];
    this._structNewMemberRanges = [];
    this._functionCalls = [];
    this._rangesAreSorted = false;
  }

  protected async removeFromYy() {
    if (!this.asset.isObject) return;
    const eventInfo = this.objectEventInfo;
    if (!eventInfo) {
      logger.warn(`Stitch does not know about the ${this.name} event type!`);
      return;
    }

    // find the match for this event
    const yy = this.asset.yy as YyObject;
    const eventIdx = yy.eventList.findIndex(
      (event) =>
        event.eventNum === eventInfo.eventNum &&
        event.eventType === eventInfo.eventType,
    );
    if (eventIdx > -1) {
      yy.eventList.splice(eventIdx, 1);
      await this.asset.saveYy();
    }
  }

  async remove() {
    // update yy file
    await this.removeFromYy();
    // remove from asset's list of files
    this.asset.gmlFiles.delete(this.path.absolute.toLocaleLowerCase());
    // remove file
    await this.path.delete();
    // reset to clear refs and diagnostics
    this.reset();
  }

  /**
   * Reprocess after a modification to the file. Optionally
   * provide new content to use instead of reading from disk.
   */
  async reload(content?: string, options?: { reloadDirty?: boolean }) {
    await this.parse(content);
    this.updateGlobals();
    this.updateAllSymbols();
    this.updateDiagnostics();
    // Re-run diagnostics on everything that ended up dirty due to the changes
    if (options?.reloadDirty) {
      this.project.drainDirtyFileUpdateQueue();
    }
  }

  protected discoverEventInheritanceWarnings() {
    this.diagnostics.MISSING_EVENT_INHERITED = [];
    if (this.asset.assetKind !== 'objects' || !this.asset.parent) {
      return;
    }
    // Then the type will have been set up to inherit from the parent.
    // BUT. If this event does not call `event_inherited()`, then we
    // need to unlink the type.
    if (!this.callsSuper) {
      // TODO: Provide this as an option?
      // this.diagnostics.MISSING_EVENT_INHERITED.push({
      //   $tag: 'diagnostic',
      //   message: `Event does not call \`event_inherited()\`, so it will not inherit from its parent.`,
      //   severity: 'warning',
      //   location: this.startRange,
      // });
      if (this.isCreateEvent) {
        // Unlink the type from the parent.
        // (If there is no create event, then event_inherited is implicit)
        this.asset.variables!.extends = this.project.native.objectInstanceBase;
      }
    } else if (this.isCreateEvent) {
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
      const func = args[0].type;
      if (!func.signifier) {
        // Then this was a generic function type and we don't know
        // how many args it takes or what it returns.
        continue;
      }
      const params = func.listParameters() || [];
      // Handle missing arguments
      for (let j = 0; j < params.length; j++) {
        const param = params[j];
        const arg = args[j] as FunctionArgRange | undefined;
        const argIsEmpty = !arg?.hasExpression;
        if (param && !param.optional && argIsEmpty) {
          this.diagnostics.MISSING_REQUIRED_ARGUMENT.push(
            Diagnostic.error(
              `Missing required argument \`${param.name}\` for function \`${func.name}\`.`,
              arg || args[0],
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

  protected computeUndeclaredSymbolDiagnostics() {
    this.diagnostics.UNDECLARED_VARIABLE_REFERENCE = [];
    const undeclaredSymbols = new Set<Signifier>();
    outer: for (const ref of this._refs) {
      if (ref.item.def || ref.item.native || undeclaredSymbols.has(ref.item)) {
        continue;
      }
      // Handle global prefixes setting
      const prefixes =
        this.project.options?.settings?.autoDeclareGlobalsPrefixes || [];
      for (const prefix of prefixes) {
        if (ref.item.name.startsWith(prefix)) {
          // Then mark it as *global* and *declared*
          ref.item.global = true;
          ref.item.local = false;
          ref.item.instance = false;
          ref.item.def = {};
          ref.item.describe(`Auto-declared by global prefix \`${prefix}\``);
          continue outer;
        }
      }

      this.diagnostics.UNDECLARED_VARIABLE_REFERENCE.push(
        Diagnostic.error(`Undeclared symbol \`${ref.item.name}\``, ref, 'warn'),
      );
      undeclaredSymbols.add(ref.item);
    }
  }

  protected computeJsdocDiagnostics() {
    this.diagnostics.JSDOC = [];
    for (const jsdoc of this.jsdocs) {
      for (const diagnostic of jsdoc.diagnostics) {
        this.diagnostics.JSDOC.push(
          Diagnostic.warn(
            diagnostic.message,
            new Range(
              Position.from(this, diagnostic.start),
              Position.from(this, diagnostic.end),
            ),
          ),
        );
      }
    }
  }

  computeUnusedSymbolDiagnostics() {
    this.diagnostics.UNUSED = [];
    const unused = new Set<Signifier>();
    for (const ref of this.refs) {
      if (
        unused.has(ref.item) ||
        !ref.isDef ||
        ref.item.native ||
        !ref.item.getTypeByKind('Function') ||
        !ref.item.global // For now restrict to global functions. The rest requires some nuance!
      ) {
        continue;
      }
      // Are all refs to the definition?
      const hasNonDefRefs = [...ref.item.refs.values()].some((r) => !r.isDef);
      if (!hasNonDefRefs) {
        unused.add(ref.item);
        this.diagnostics.UNUSED.push(
          Diagnostic.info(`Unused function \`${ref.item.name}\``, ref),
        );
      }
    }
  }

  /** Update and emit diagnostics */
  updateDiagnostics() {
    this.discoverEventInheritanceWarnings();
    this.computeFunctionCallDiagnostics();
    this.computeUndeclaredSymbolDiagnostics();
    this.computeJsdocDiagnostics();
    this.computeUnusedSymbolDiagnostics();
    const allDiagnostics: Diagnostic[] = [];
    for (const items of Object.values(this.diagnostics)) {
      allDiagnostics.push(...items);
    }
    this.project.emitDiagnostics(this, allDiagnostics);
    return allDiagnostics;
  }

  updateGlobals() {
    this.reset();
    return registerGlobals(this);
  }

  updateAllSymbols() {
    registerSignifiers(this);
  }
}
