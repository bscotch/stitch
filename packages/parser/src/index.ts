export type { GmlSymbolType } from './gml.js';
export { GmlFile } from './project.gml.js';
export { GameMakerProjectParser } from './project.js';
export { Location } from './project.locations.js';
export { GameMakerResource } from './project.resource.js';
export { LocalScope, ScopeRange } from './project.scopes.js';
export {
  GlobalVar as GlobalVariable,
  LocalVar as LocalVariable,
  ProjectSymbolType,
  SelfSymbol as SelfVariable,
  SymbolRef,
} from './project.symbols.js';
export type {
  Diagnostic,
  GmlParseError,
  GmlSymbolKind,
  SymbolKind,
} from './types.legacy.js';
