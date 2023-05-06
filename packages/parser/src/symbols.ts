import { Pathy } from '@bscotch/pathy';
import { GmlSpec } from './gmlSpecSchema.js';

type GmlFilePath = string;
type GmlSymbolName = string;

/**
 * A "context" contains a collection of declared
 * symbols. The combination of a symbol name and its
 * context makes it a fully qualified symbol (unique
 * to the project).
 */
interface GmlContext {
  kind: 'global' | 'instance' | 'struct';
  name: string;
  scopes: GmlScope[];
  symbols: Map<GmlSymbolName, GmlSymbol>;
}

/**
 * A "Scope" is a region of code within which a local variable
 * is declared and accessible. A scope has an associated Context
 * (though a Context can have multiple Scopes), which will also
 * provide Context-specific symbols.
 */
interface GmlScope {
  /**
   * Whether or not a given index position is contained
   * within this scope.
   */
  enclosesPosition(position: number): boolean;
}

/**
 * A symbol is a named entity declared in some scope
 * that can be referenced in various places.
 */
interface GmlSymbol {
  local?: boolean;
  declaration: {
    file: GmlFilePath;
    position: number;
  };
  refs: Map<GmlScope, GmlSymbolRef[]>;
}

interface GmlSymbolRef {
  file: GmlFilePath;
  position: number;
}
/**
 * A class for getting symbol information from a GameMaker
 * project, enabling lookups of symbol definitions and
 * references, as well as discovery of allowed symbols
 * for a given scope (e.g. for editor auto-completion).
 */
export class GmlSymbols {
  protected scopes: Map<GmlFilePath, GmlScope[]> = new Map();

  constructor(readonly spec: GmlSpec) {}

  getFileScopes(uri: string): GmlScope[] {
    const path = Pathy.normalize(uri);
    return this.scopes.get(path) ?? [];
  }

  /**
   * Given a document URI and a position, return the
   * scope at that position.
   */
  getScopeAt(uri: string, position: number): GmlScope | undefined {
    return this.getFileScopes(uri).find((scope) =>
      scope.enclosesPosition(position),
    );
  }

  /**
   * Given a document URI and a position, return the symbol
   * at that position, if any.
   */
  getSymbolAt(uri: string, position: number): GmlSymbol | undefined {
    return undefined;
  }

  /**
   * Given a document URI and a position, return the list of
   * existing symbols that are allowed at that position.
   */
  getSymbolsInScopeAt(uri: string, position: number): GmlSymbol[] {
    return [];
  }

  /**
   * Given a symbol, return the list of all
   * references to that symbol.
   */
  getSymbolReferences(scope: GmlSymbol, name: string): GmlSymbolRef[] {
    return [];
  }
}
