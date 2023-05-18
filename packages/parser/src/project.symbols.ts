import type { IToken } from 'chevrotain';
import type { Location } from './project.locations.js';
import type { SymbolBase, SymbolKind, SymbolRefBase } from './types.js';

export type ProjectSymbolType =
  | LocalVar
  | SelfSymbol
  | GlobalVar
  | GlobalFunction
  | Macro
  | Enum
  | EnumMember;

export class SymbolRef implements SymbolRefBase {
  readonly type = 'symbolRef';
  constructor(
    public readonly symbol: ProjectSymbolType,
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

abstract class ProjectSymbol implements SymbolBase {
  readonly type = 'symbol';
  readonly native = false;
  abstract kind: SymbolKind;
  location?: Location;
  refs = new Set<SymbolRef>();
  deprecated?: boolean;
  global?: boolean;

  constructor(protected readonly _name: string, location: Location) {
    this.location = location;
    this.addRef(location, true);
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
    const ref = new SymbolRef(
      this as ProjectSymbolType,
      location,
      isDeclaration,
    );
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

export class LocalVar extends ProjectSymbol {
  readonly kind = 'localVariable';
  constructor(name: string, location: Location, public isParam = false) {
    super(name, location);
  }

  override get code() {
    return this.isParam ? this.name : `var ${this.name}`;
  }
}

export class SelfSymbol extends ProjectSymbol {
  readonly kind = 'selfVariable';
  constructor(name: string, location: Location, readonly isStatic = false) {
    super(name, location);
  }

  override get code() {
    return this.isStatic ? `static ${this.name}` : `self.${this.name}`;
  }
}

export class GlobalVar extends ProjectSymbol {
  override global = true;
  readonly kind = 'globalVariable';
  override get code() {
    return `globalvar ${this.name}`;
  }
}

class FunctionParam extends ProjectSymbol {
  readonly kind = 'functionParam';
  optional?: boolean;

  override get code() {
    return `/** @param */ ${this.name}`;
  }
}

export class GlobalFunction extends ProjectSymbol {
  override global = true;
  readonly kind = 'globalFunction';
  isConstructor?: boolean;
  params: FunctionParam[] = [];

  override get code() {
    const params = this.params.map((p) => p.name);
    let code = `function ${this.name} (${params.join(', ')})`;
    if (this.isConstructor) {
      code += `constructor`;
    }
    return code;
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

export class Macro extends ProjectSymbol {
  override global = true;
  readonly kind = 'macro';
}

export class EnumMember extends ProjectSymbol {
  readonly kind = 'enumMember';
}

export class Enum extends ProjectSymbol {
  override global = true;
  readonly kind = 'enum';
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
