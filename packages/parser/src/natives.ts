/**
 * Build the table of native (built-in) GML symbols from GmlSpec files.
 */
import { parseDocType } from '@bscotch/gml-syntax';
import {
  spriteInfoArrayFields,
  spriteInfoVariables,
  type NativeFieldInfo,
} from './natives.spriteInfo.ts';
import type { GmlSpec, GmlSpecFunction } from './spec.ts';
import {
  ids,
  SymbolTable,
  type FunctionEntry,
  type ShapeEntry,
  type SymbolEntry,
} from './symbols.ts';
import {
  T,
  typeFromDoc,
  typeFromName,
  type DocTypeContext,
  type Type,
} from './types.ts';

/** Parse a type string, e.g. from a spec, into a union */
export function parseTypeString(
  text: string,
  ctx: DocTypeContext = {},
): Type[] {
  const { type } = parseDocType(text, 0, text.length);
  return type ? typeFromDoc(type, ctx) : [T.any];
}

const argumentIdentity: Type = {
  kind: 'ArgumentIdentity',
  name: 'ArgumentIdentity',
  generic: true,
};

/**
 * The native symbol table: global functions, variables and constants,
 * native structs and enums, and the base shape of every object instance
 * (which holds the built-in instance variables like `x` and `sprite_index`).
 */
export class NativeTable extends SymbolTable {
  readonly modules: string[] = [];

  constructor(specs: GmlSpec[]) {
    super();
    this.addShape({ id: ids.globalShape, kind: 'global', name: 'global' });
    this.addShape({
      id: ids.instanceBase,
      kind: 'instanceBase',
      readonly: true,
    });
    this.types.set('Id.Instance', T.instance);
    this.types.set('Asset.GMObject', { kind: 'Asset.GMObject' });

    // The base module first, so other modules can't shadow it
    const sorted = [...specs].sort(
      (a, b) =>
        Number(b.module.toLowerCase() === 'base') -
        Number(a.module.toLowerCase() === 'base'),
    );
    this.addManualEntries();
    for (const spec of sorted) {
      this.modules.push(spec.module);
      this.loadConstants(spec);
      this.loadEnumerations(spec);
      this.loadStructures(spec);
      this.loadVariables(spec);
      this.loadFunctions(spec);
    }
  }

  protected ctx: DocTypeContext = {
    resolve: (name) => this.getType(name),
  };

  protected parse(text: string, ctx = this.ctx): Type[] {
    return parseTypeString(text, ctx);
  }

  protected addShape(shape: Omit<ShapeEntry, 'members' | 'parents'>) {
    const entry: ShapeEntry = { parents: [], members: new Map(), ...shape };
    this.shapes.set(entry.id, entry);
    return entry;
  }

  protected addSymbol(
    shape: ShapeEntry,
    symbol: Omit<SymbolEntry, 'id' | 'owner'> & { id?: string },
  ): SymbolEntry {
    const entry: SymbolEntry = {
      id: symbol.id ?? ids.member(shape.id, symbol.name),
      owner: shape.id,
      ...symbol,
    };
    this.symbols.set(entry.id, entry);
    shape.members.set(entry.name, entry.id);
    return entry;
  }

  protected get global(): ShapeEntry {
    return this.shapes.get(ids.globalShape)!;
  }

  protected get instance(): ShapeEntry {
    return this.shapes.get(ids.instanceBase)!;
  }

  protected loadConstants(spec: GmlSpec) {
    // Constants with a "class" share a named type, e.g. `Constant.Color`
    const classTypes = new Map<string, Type>();
    for (const constant of spec.constants) {
      if (this.global.members.has(constant.name)) continue;
      let type: Type[];
      if (constant.class) {
        let classType = classTypes.get(constant.class);
        if (!classType) {
          const [base] = this.parse(constant.type);
          classType = {
            kind: base?.kind ?? 'Any',
            name: constant.class,
            constant: true,
          };
          classTypes.set(constant.class, classType);
          this.types.set(`Constant.${constant.class}`, classType);
        }
        type = [classType];
      } else {
        type = this.parse(constant.type);
      }
      this.addSymbol(this.global, {
        id: ids.global(constant.name),
        name: constant.name,
        kind: 'constant',
        type,
        description: constant.description,
        deprecated: constant.deprecated || undefined,
        native: spec.module,
        global: true,
        writable: false,
      });
    }
  }

  protected loadEnumerations(spec: GmlSpec) {
    for (const enumeration of spec.enumerations) {
      if (this.global.members.has(enumeration.name)) continue;
      const shape = this.addShape({
        id: ids.enumShape(enumeration.name),
        kind: 'enum',
        name: enumeration.name,
        readonly: true,
      });
      const enumType: Type = { kind: 'Enum', name: enumeration.name };
      this.types.set(`Enum.${enumeration.name}`, enumType);
      const symbol = this.addSymbol(this.global, {
        id: ids.global(enumeration.name),
        name: enumeration.name,
        kind: 'enum',
        type: [enumType],
        shape: shape.id,
        native: spec.module,
        global: true,
        writable: false,
      });
      shape.symbol = symbol.id;
      for (const [idx, member] of enumeration.members.entries()) {
        this.addSymbol(shape, {
          name: member.name,
          kind: 'enumMember',
          type: [
            { kind: 'EnumMember', name: `${enumeration.name}.${member.name}` },
          ],
          description: member.description,
          deprecated: member.deprecated || undefined,
          native: spec.module,
          idx,
          value: member.value,
          writable: false,
        });
      }
    }
  }

  protected loadStructures(spec: GmlSpec) {
    for (const struct of spec.structures) {
      if (!struct.name || this.shapes.has(ids.structShape(struct.name))) {
        continue;
      }
      this.addNativeStruct(
        struct.name,
        spec.module,
        struct.properties.map((p) => ({
          name: p.name,
          type: p.type,
          description: p.description,
          writable: p.writable,
        })),
      );
    }
  }

  protected addNativeStruct(
    name: string,
    module: string,
    fields: {
      name: string;
      type: string | Type[];
      description?: string;
      writable?: boolean;
    }[],
  ): ShapeEntry {
    const shape = this.addShape({
      id: ids.structShape(name),
      kind: 'struct',
      name,
      readonly: true,
    });
    this.types.set(`Struct.${name}`, { kind: 'Struct', name });
    for (const field of fields) {
      if (shape.members.has(field.name)) continue;
      this.addSymbol(shape, {
        name: field.name,
        kind: 'variable',
        type:
          typeof field.type === 'string' ? this.parse(field.type) : field.type,
        description: field.description,
        native: module,
        instance: true,
        writable: field.writable ?? true,
      });
    }
    return shape;
  }

  protected loadVariables(spec: GmlSpec) {
    for (const variable of spec.variables) {
      // Instance variables (x, sprite_index, ...) belong to every instance,
      // not to the global scope
      const shape = variable.instance ? this.instance : this.global;
      if (shape.members.has(variable.name)) continue;
      this.addSymbol(shape, {
        id: variable.instance
          ? ids.member(ids.instanceBase, variable.name)
          : ids.global(variable.name),
        name: variable.name,
        kind: 'variable',
        type: this.parse(variable.type),
        description: variable.description,
        deprecated: variable.deprecated || undefined,
        native: spec.module,
        global: !variable.instance || undefined,
        instance: variable.instance || undefined,
        writable: variable.writable,
      });
    }
  }

  protected loadFunctions(spec: GmlSpec) {
    for (const func of spec.functions) {
      const existing = this.global.members.get(func.name);
      if (existing) {
        const symbol = this.symbols.get(existing)!;
        symbol.description ||= func.description;
        continue;
      }
      this.addNativeFunction(func, spec.module);
    }
  }

  /**
   * Native functions that use `ArgumentIdentity` return or accept the same
   * type they were given. Containers in their signatures are assumed to
   * hold that type, e.g. `array_pop(Array) → ArgumentIdentity` becomes
   * `array_pop(Array<T>) → T`.
   */
  protected addNativeFunction(func: GmlSpecFunction, module: string) {
    const usesGeneric =
      func.returnType.includes('ArgumentIdentity') ||
      func.parameters.some((p) => p.type.includes('ArgumentIdentity'));
    const generic = (type: string) =>
      usesGeneric
        ? type.replace(/^(id\.ds[a-z]+|array)(<\w+>)?/i, '$1<ArgumentIdentity>')
        : type;
    const ctx: DocTypeContext = {
      ...this.ctx,
      generics: new Map([['ArgumentIdentity', argumentIdentity]]),
    };
    const fnId = ids.fn(func.name);
    const localId = ids.local(fnId);
    const params: string[] = [];
    let variadic = false;
    for (const [idx, param] of func.parameters.entries()) {
      if (param.name === '...') variadic = true;
      const symbol: SymbolEntry = {
        id: ids.member(
          localId,
          param.name === '...' ? `...${idx}` : param.name,
        ),
        owner: localId,
        name: param.name,
        kind: 'parameter',
        type: this.parse(generic(param.type), ctx),
        description: param.description,
        native: module,
        parameter: true,
        local: true,
        idx,
        optional: param.optional || param.name === '...' || undefined,
        writable: true,
      };
      this.symbols.set(symbol.id, symbol);
      params.push(symbol.id);
    }
    const fn: FunctionEntry = {
      id: fnId,
      name: func.name,
      symbol: ids.global(func.name),
      params,
      returns: this.parse(generic(func.returnType), ctx),
      isConstructor: false,
      templates: usesGeneric ? ['ArgumentIdentity'] : undefined,
      description: func.description,
      deprecated: func.deprecated || undefined,
      variadic: variadic || undefined,
    };
    this.functions.set(fn.id, fn);
    this.types.set(`Function.${func.name}`, {
      kind: 'Function',
      name: func.name,
    });
    this.addSymbol(this.global, {
      id: ids.global(func.name),
      name: func.name,
      kind: 'function',
      type: [{ kind: 'Function', name: func.name }],
      fn: fn.id,
      description: func.description,
      deprecated: func.deprecated || undefined,
      native: module,
      global: true,
      writable: false,
    });
  }

  /** Natives that the specs don't describe (well) */
  protected addManualEntries() {
    const fn = (
      name: string,
      params: { name: string; type: string; optional?: boolean }[],
      returnType: string,
      description?: string,
    ) =>
      this.addNativeFunction(
        {
          module: 'Base',
          name,
          description,
          deprecated: false,
          pure: false,
          returnType,
          featureFlag: undefined,
          locale: undefined,
          parameters: params.map((p) => ({
            name: p.name,
            type: p.type,
            optional: !!p.optional,
            description: undefined,
            coerce: undefined,
          })),
        },
        'Base',
      );
    fn('throw', [{ name: 'message', type: 'Any' }], 'Never');
    fn('display_get_frequency', [], 'Real');
    // `static_get` returns the static struct of its argument
    fn('static_get', [{ name: 'target', type: 'Function|Struct' }], 'Struct');
    const staticGet = this.functions.get(ids.fn('static_get'))!;
    const t: Type = { kind: 'Any', name: 'T', generic: true };
    staticGet.templates = ['T'];
    this.symbols.get(staticGet.params[0])!.type = [t];
    staticGet.returns = [{ kind: 'StaticType', items: [t] }];

    this.addSpriteInfo();
  }

  protected addSpriteInfo() {
    const toFields = (fields: NativeFieldInfo[]) =>
      fields.map((f) => ({
        name: f.variable,
        type: f.type,
        description: f.description,
        writable: false,
      }));
    const info = this.addNativeStruct(
      'SpriteInfo',
      'Base',
      toFields(spriteInfoVariables),
    );
    for (const [field, items, name] of spriteInfoArrayFields) {
      this.addNativeStruct(name, 'Base', toFields(items));
      const symbol = this.symbols.get(info.members.get(field)!);
      if (symbol)
        symbol.type = [{ kind: 'Array', items: [{ kind: 'Struct', name }] }];
    }
  }

  /** Resolve a type name (e.g. from a doc comment) using native types */
  resolveTypeName(name: string): Type | undefined {
    return typeFromName(name, this.ctx);
  }
}
