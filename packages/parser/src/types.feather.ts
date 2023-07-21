import {
  parseFeatherTypeString,
  type FeatherType,
  type FeatherTypeUnion,
} from './jsdoc.feather.js';
import type { JsdocSummary } from './jsdoc.js';
import { Type } from './types.js';
import { primitiveNames } from './types.primitives.js';
import { ok } from './util.js';

export function typeFromFeatherString(
  typeString: string,
  knownTypes: Map<string, Type>,
  addMissing: boolean,
): Type[] {
  const parsed = parseFeatherTypeString(typeString);
  return typeFromParsedFeatherString(parsed, knownTypes, addMissing);
}

/**
 * Given a type identifier, get a parsed Type instance. Useful for
 * the "leaves" of a type tree, e.g. "String" or "Struct.Mystruct".
 * Only creates primitive types, e.g. "Struct.MyStruct" will return
 * a plain `Type<"Struct">` instance.
 *
 * When knownTypes are provided, will return a known type by exact
 * identifier match if it exists. Otherwise a new type instance will
 * be created *and added to the knownTypes map*.
 */
export function typeFromIdentifier(
  identifier: string,
  knownTypes: Map<string, Type>,
  addMissing: boolean,
  __isRootRequest = true,
): Type {
  ok(
    identifier.match(/^[A-Z][A-Z0-9._]*$/i),
    `Invalid type name ${identifier}`,
  );
  const normalizedName = identifier?.toLocaleLowerCase?.();
  const isObjectType = ['asset.gmobject', 'id.instance'].includes(
    normalizedName as any,
  );

  const knownType = knownTypes.get(identifier);
  if (knownType && isObjectType) {
    // Need a derived type to prevent mutation of the parent!
    return knownType.derive();
  } else if (knownType) {
    return knownType;
  }

  const primitiveType = primitiveNames.find(
    (n) => n?.toLocaleLowerCase?.() === normalizedName,
  );
  if (primitiveType && !isObjectType) {
    return new Type(primitiveType);
  }

  if (identifier.match(/\./)) {
    // Then we might still be able to get a base type.
    const [baseType, ...nameParts] = identifier.split('.');
    const type = typeFromIdentifier(baseType, knownTypes, addMissing, false);
    if (__isRootRequest && type) {
      // Then add to the known types map
      const derivedTyped = type.derive().named(nameParts.join('.'));
      // Types should only be auto-added when loading the native spec
      if (addMissing) {
        knownTypes.set(identifier, derivedTyped);
      }
      return derivedTyped;
    }
    return type;
  }
  return new Type('Undefined');
}

export function typeFromParsedJsdocs(
  jsdoc: JsdocSummary,
  knownTypes: Map<string, Type>,
  addMissing: boolean,
): Type[] {
  if (jsdoc.kind === 'description') {
    // Then we have no type info.
    return [];
  } else if (
    ['type', 'instancevar', 'globalvar', 'localvar'].includes(jsdoc.kind)
  ) {
    // Then this was purely a type annotation. Create the type and
    // add any metadata.
    return typeFromFeatherString(
      jsdoc.type?.content || 'Any',
      knownTypes,
      addMissing,
    );
  } else if (jsdoc.kind === 'self') {
    return typeFromFeatherString(
      jsdoc.self?.content || 'Any',
      knownTypes,
      addMissing,
    );
  } else if (jsdoc.kind === 'function') {
    const type = new Type('Function').describe(jsdoc.description);
    let i = 0;
    if (jsdoc.self) {
      type.context = typeFromFeatherString(
        jsdoc.self!.content,
        knownTypes,
        addMissing,
      )[0] as Type<any>;
    }
    if (jsdoc.returns) {
      const returnType = typeFromFeatherString(
        jsdoc.returns.type!.content,
        knownTypes,
        addMissing,
      );
      type.addReturnType(returnType);
    }
    for (const param of jsdoc.params || []) {
      const member = type.addParameter(i, param.name!.content);
      if (param.type) {
        member.setType(
          typeFromFeatherString(param.type.content, knownTypes, addMissing),
        );
      }
      i++;
      member.optional = !!param.optional;
      member.describe(param.description);
    }
    return [type];
  }
  return [];
}
export function typeFromParsedFeatherString(
  node: FeatherTypeUnion | FeatherType,
  knownTypes: Map<string, Type>,
  addMissing: boolean,
): Type[] {
  if (node.kind === 'type') {
    const identifier = node.name;
    let type = typeFromIdentifier(identifier, knownTypes, addMissing);
    if (node.of) {
      const subtypes = typeFromParsedFeatherString(
        node.of,
        knownTypes,
        addMissing,
      );
      // Then we need to create a new type instead of mutating
      // the one we found.
      type = type.derive();
      if (type.kind.match(/^(Array|Struct|Id.Ds)/)) {
        for (const subtype of subtypes) {
          type.addItemType(subtype);
        }
      }
      // TODO: Else create a diagnostic?
    }
    return [type];
  } else if (node.kind === 'union') {
    const unionOf = node.types;
    if (unionOf.length === 1) {
      return typeFromParsedFeatherString(unionOf[0], knownTypes, addMissing);
    }
    const types: Type[] = [];
    for (const child of unionOf) {
      const subtype = typeFromParsedFeatherString(
        child,
        knownTypes,
        addMissing,
      );
      types.push(...subtype);
    }
    return types;
  }
  throw new Error(`Unknown node type ${node['name']}`);
}
