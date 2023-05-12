import type { IToken } from 'chevrotain';
import { Location } from './symbols.location.js';

export class SymbolRef {
  constructor(
    public readonly symbol: ProjectSymbol,
    public readonly location: Location,
    public readonly isDeclaration = false,
  ) {}

  get startOffset() {
    return this.location.offset;
  }

  get endOffset() {
    return this.startOffset + this.symbol.name.length;
  }
}

export class ProjectSymbol {
  kind = 'projectSymbol';
  location?: Location;
  refs = new Set<SymbolRef>();
  description?: string;
  deprecated?: boolean;
  global?: boolean;

  constructor(public readonly name: string, location: Location) {
    this.location = location;
  }

  addRef(location: Location, isDeclaration = false) {
    const ref = new SymbolRef(this, location, isDeclaration);
    this.refs.add(ref);
    location.file.refs.push(ref);
  }

  get startOffset() {
    return this.location?.offset || 0;
  }

  get endOffset() {
    return this.startOffset + this.name.length;
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
  override global = true;
  override kind = 'globalVariable';
}

class FunctionParam extends ProjectSymbol {
  override kind = 'functionParam';
  optional?: boolean;
}

export class GlobalFunction extends GlobalVariable {
  override global = true;
  override kind = 'globalFunction';
  returnType?: unknown; // TODO: implement
  params: FunctionParam[] = [];

  addParam(paramIdx: number, token: IToken, location: Location) {
    if (this.params[paramIdx]) {
      // Update the location in case it has changed
      this.params[paramIdx].location = location;
    } else {
      this.params.push(new FunctionParam(token.image, location));
    }
  }
}

export class GlobalConstructorFunction extends GlobalFunction {
  override global = true;
  override kind = 'globalConstructorFunction';
}

export class Macro extends ProjectSymbol {
  override global = true;
  override kind = 'macro';
}

export class EnumMember extends ProjectSymbol {
  override kind = 'enumMember';
}

export class Enum extends ProjectSymbol {
  override global = true;
  override kind = 'enum';
  members = new Map<string, EnumMember>();

  // Ensure only added once!
  addMember(token: IToken, location: Location) {
    if (this.members.has(token.image)) {
      // Update the location in case it has changed
      this.getMember(token.image)!.location = location;
      return;
    }
    this.members.set(token.image, new EnumMember(token.image, location));
  }

  hasMember(name: string) {
    return this.members.has(name);
  }

  getMember(name: string) {
    return this.members.get(name);
  }
}
