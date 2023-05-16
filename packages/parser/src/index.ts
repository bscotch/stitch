export type { GmlSymbolType } from './gml.js';
export { GmlFile } from './project.gml.js';
export { GameMakerProjectParser } from './project.js';
export { Location } from './symbols.location.js';
export { LocalScope, ScopeRange } from './symbols.scopes.js';
export {
  GlobalVar as GlobalVariable,
  LocalVar as LocalVariable,
  ProjectSymbolType,
  SelfSymbol as SelfVariable,
  SymbolRef,
} from './symbols.symbol.js';
export type { GmlSymbolKind, SymbolKind } from './types.js';
