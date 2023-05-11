import type { IToken } from 'chevrotain';
import { Location } from './symbols.location.js';

export class SymbolRef {
  constructor(
    public readonly symbol: ProjectSymbol,
    public readonly location: Location,
    public readonly isDeclaration = false,
  ) {}
}

export class ProjectSymbol {
  kind = 'projectSymbol';
  refs: SymbolRef[] = [];
  description?: string;
  deprecated?: boolean;
  type?: unknown; // TODO: implement

  /**
   * We may not know where a symbol is defined the first time we see it,
   * so we can set the location later if necessary.
   */
  constructor(public readonly name: string, public location: Location) {
    this.addRef(location, true);
  }

  addRef(location: Location, isDeclaration = false) {
    this.refs.push(new SymbolRef(this, location, isDeclaration));
    location.file.refs.push(this);
  }
}

export class LocalVariable extends ProjectSymbol {
  override kind = 'localVariable';
  constructor(name: string, location: Location, public isParam = false) {
    super(name, location);
  }
}

export class SelfVariable extends ProjectSymbol {
  override kind = 'selfVariable';
}

export class GlobalVariable extends ProjectSymbol {
  override kind = 'globalVariable';
}

class FunctionParam extends ProjectSymbol {
  override kind = 'functionParam';
  optional?: boolean;
}

export class GlobalFunction extends GlobalVariable {
  returnType?: unknown; // TODO: implement
  params: FunctionParam[] = [];

  // TODO: Ensure only added once!
  addParam(token: IToken, location: Location) {
    this.params.push(new FunctionParam(token.image, location));
  }
}

export class Macro extends ProjectSymbol {
  override kind = 'macro';
}

export class EnumMember extends ProjectSymbol {
  override kind = 'enumMember';
}

export class Enum extends ProjectSymbol {
  override kind = 'enum';
  members = new Map<string, EnumMember>();

  // TODO: Ensure only added once!
  addMember(token: IToken, location: Location) {
    this.members.set(token.image, new EnumMember(token.image, location));
  }
}
