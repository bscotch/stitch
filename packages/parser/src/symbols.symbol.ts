import type { IToken } from 'chevrotain';
import type { Location } from './symbols.location.js';
import type { SymbolBase, SymbolRefBase } from './types.js';

export class SymbolRef implements SymbolRefBase {
  constructor(
    public readonly symbol: ProjectSymbol,
    public readonly location: Location,
    public readonly isDeclaration = false,
  ) {}

  get start() {
    return this.location.startOffset;
  }

  get end() {
    return this.start + this.symbol.name.length;
  }
}

export class ProjectSymbol implements SymbolBase {
  kind = 'projectSymbol';
  location?: Location;
  refs = new Set<SymbolRef>();
  deprecated?: boolean;
  global?: boolean;

  constructor(protected readonly _name: string, location: Location) {
    this.location = location;
  }

  get name() {
    return this._name;
  }

  get description() {
    return undefined;
  }

  get code(): string | undefined {
    return this.name;
  }

  addRef(location: Location, isDeclaration = false) {
    const ref = new SymbolRef(this, location, isDeclaration);
    this.refs.add(ref);
    location.file.addRef(ref);
  }

  get start() {
    return this.location?.startOffset || 0;
  }

  get end() {
    return this.start + this.name.length;
  }
}

export class LocalVariable extends ProjectSymbol {
  override kind = 'localVariable';
  constructor(name: string, location: Location, public isParam = false) {
    super(name, location);
  }

  override get code() {
    return this.isParam ? this.name : `var ${this.name}`;
  }
}

export class SelfVariable extends ProjectSymbol {
  override kind = 'selfVariable';
  constructor(name: string, location: Location, readonly isStatic = false) {
    super(name, location);
  }

  override get code() {
    return this.isStatic ? `static ${this.name}` : `self.${this.name}`;
  }
}

export class GlobalVariable extends ProjectSymbol {
  override global = true;
  override kind = 'globalVariable';
  override get code() {
    return `global.${this.name}`;
  }
}

class FunctionParam extends ProjectSymbol {
  override kind = 'functionParam';
  optional?: boolean;
}

export class GlobalFunction extends GlobalVariable {
  override global = true;
  override kind = 'globalFunction';
  params: FunctionParam[] = [];

  override get code() {
    const params = this.params.map((p) => p.name);
    return `global.${this.name} = function (${params.join(', ')})`;
  }

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

  override get code() {
    const params = this.params.map((p) => p.name);
    return `global.${this.name} = constructor (${params.join(', ')})`;
  }
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
