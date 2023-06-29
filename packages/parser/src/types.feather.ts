import { arrayWrapped } from '@bscotch/utility';
import {
  parseFeatherTypeString,
  type FeatherType,
  type FeatherTypeUnion,
} from './jsdoc.feather.js';
import type { JsdocSummary } from './jsdoc.js';
import { StructType, Type } from './types.js';
import { primitiveNames } from './types.primitives.js';
import { ok } from './util.js';

export function typeFromFeatherString(
  typeString: string,
  knownTypes: Map<string, Type>,
): Type[] {
  const parsed = parseFeatherTypeString(typeString);
  return typeFromParsedFeatherString(parsed, knownTypes);
}

/**
 * Given a type identifier, get a parsed Type instance. Useful for
 * the "leaves" of a type tree, e.g. "String" or "Struct.Mystruct".
 * Only creates primitive types, e.g. "Struct.MyStruct" will return
 * a plain `Type<"Struct">` instance.
 *
 * When knownTypes are provided, will return a known type by exact
 * identifier match if it exists. Otherwise a new type instance will
 * be created.
 */
export function typeFromIdentifier(
  identifier: string,
  knownTypes: Map<string, Type>,
): Type | undefined {
  ok(
    identifier.match(/^[A-Z][A-Z0-9._]*$/i),
    `Invalid type name ${identifier}`,
  );
  const knownType = knownTypes.get(identifier);
  if (knownType) {
    return knownType;
  }
  const normalizedName = identifier.toLocaleLowerCase();
  const primitiveType = primitiveNames.find(
    (n) => n.toLocaleLowerCase() === normalizedName,
  );
  if (primitiveType) {
    return new Type(primitiveType);
  } else if (identifier.match(/\./)) {
    // Then this is probably some sort of Base.Signifier[.name] identifier.
    // Work our way backwards until we find a known or primitive type.
    const parts = identifier.split('.');
    const baseIdentifier = parts.slice(0, -1).join('.');
    const name = parts.at(-1);
    const type = typeFromIdentifier(baseIdentifier, knownTypes);
    if (!type) {
      return;
    }
    return type.extend().setName(name);
  }
  return;
}

export function typeFromParsedJsdocs(
  jsdoc: JsdocSummary,
  knownTypes: Map<string, Type>,
): Type[] {
  if (jsdoc.kind === 'description') {
    // Then we have no type info
    const type = new Type('Any');
    return arrayWrapped(type);
  } else if (jsdoc.kind === 'type') {
    // Then this was purely a type annotation. Create the type and
    // add any metadata.
    return typeFromFeatherString(jsdoc.type!.content, knownTypes);
  } else if (jsdoc.kind === 'self') {
    return typeFromFeatherString(jsdoc.self!.content, knownTypes);
  } else if (jsdoc.kind === 'function') {
    const type = new Type('Function');
    let i = 0;
    if (jsdoc.self) {
      const contextType = typeFromFeatherString(
        jsdoc.self!.content,
        knownTypes,
      )?.[0];
      if (contextType) {
        type.setContextType(contextType as StructType);
      }
    }
    if (jsdoc.returns) {
      const returnType = typeFromFeatherString(
        jsdoc.returns.type!.content,
        knownTypes,
      );
      type.setReturnType(returnType);
    }
    for (const param of jsdoc.params || []) {
      const paramType = typeFromFeatherString(param.type!.content, knownTypes);
      const member = type.setParam(i, param.name!.content, paramType);
      i++;
      member.optional = param.optional || false;
      member.describe(param.description);
    }
    return [type];
  }
  throw new Error(`Unknown JSDoc kind ${jsdoc.kind}`);
}

export function typeFromParsedFeatherString(
  node: FeatherTypeUnion | FeatherType,
  knownTypes: Map<string, Type>,
): Type[] {
  if (node.kind === 'type') {
    const identifier = node.name;
    let type = typeFromIdentifier(identifier, knownTypes);
    if (!type) {
      return [];
    }
    if (node.of && type.isContainer) {
      const subtypes = typeFromParsedFeatherString(node.of, knownTypes);
      // Then we need to create a new type instead of mutating
      // the one we found.
      type = type.extend();
      for (const subtype of subtypes) {
        type.setContainedTypes(subtype);
      }
    }
    return [type];
  } else if (node.kind === 'union') {
    const unionOf = node.types;
    if (unionOf.length === 1) {
      return typeFromParsedFeatherString(unionOf[0], knownTypes);
    }
    const types: Type[] = [];
    for (const child of unionOf) {
      const subtype = typeFromParsedFeatherString(child, knownTypes);
      types.push(...subtype);
    }
    return types;
  }
  throw new Error(`Unknown node type ${node['name']}`);
}
