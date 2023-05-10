import type { IToken } from 'chevrotain';
import type { GmlFile } from './project.gml.js';
import { FileName, Location } from './symbols.location.js';

export abstract class ProjectSymbol {
  refs: Map<FileName, Location[]> = new Map();

  /**
   * We may not know where a symbol is defined the first time we see it,
   * so we can set the location later if necessary.
   */
  constructor(public readonly name: string, public location?: Location) {}
}

export class LocalVariable extends ProjectSymbol {
  constructor(name: string, location: Location, public isParam = false) {
    super(name, location);
  }
}

export class SelfVariable extends ProjectSymbol {}

export class GlobalVariable extends ProjectSymbol {}

export class Macro extends ProjectSymbol {}

export class EnumMember extends ProjectSymbol {}

export class Enum extends ProjectSymbol {
  members = new Map<string, EnumMember>();

  addMember(token: IToken, file: GmlFile) {
    this.members.set(
      token.image,
      new EnumMember(token.image, Location.from(token, file)),
    );
  }
}
