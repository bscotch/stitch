import { GmlSpec } from './gmlSpecSchema.js';

/**
 * A class for getting symbol information from a GameMaker
 * project, enabling lookups of symbol definitions and
 * references, as well as discovery of allowed symbols
 * for a given scope (e.g. for editor auto-completion).
 */
export class Symbols {
  constructor(readonly spec: GmlSpec) {}
}
