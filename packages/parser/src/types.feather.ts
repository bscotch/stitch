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
): Type {
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
 * be created *and added to the knownTypes map*.
 */
export function typeFromIdentifier(
  identifier: string,
  knownTypes: Map<string, Type>,
  __isRootRequest = true,
): Type {
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
    // Then we might still be able to get a base type.
    const [baseType, ...nameParts] = identifier.split('.');
    const type = typeFromIdentifier(baseType, knownTypes, false);
    if (__isRootRequest && type) {
      // Then add to the known types map
      const derivedTyped = type.derive().named(nameParts.join('.'));
      knownTypes.set(identifier, derivedTyped);
      return derivedTyped;
    }
    return type;
  }
  return new Type('Unknown');
}
export function typeFromParsedJsdocs(
  jsdoc: JsdocSummary,
  knownTypes: Map<string, Type>,
): Type {
  if (jsdoc.kind === 'description') {
    // Then we have no type info but have a description to add.
    return typeFromIdentifier('Unknown', knownTypes).describe(
      jsdoc.description,
    );
  } else if (jsdoc.kind === 'type') {
    // Then this was purely a type annotation. Create the type and
    // add any metadata.
    return typeFromFeatherString(jsdoc.type!.content, knownTypes).describe(
      jsdoc.description,
    );
  } else if (jsdoc.kind === 'self') {
    return typeFromFeatherString(jsdoc.self!.content, knownTypes).describe(
      jsdoc.description,
    );
  } else if (jsdoc.kind === 'function') {
    const type = typeFromIdentifier('Function', knownTypes).describe(
      jsdoc.description,
    );
    let i = 0;
    if (jsdoc.deprecated) {
      type.deprecated = true;
    }
    if (jsdoc.self) {
      type.context = typeFromFeatherString(
        jsdoc.self!.content,
        knownTypes,
      ) as Type<any>;
    }
    if (jsdoc.returns) {
      const returnType = typeFromFeatherString(
        jsdoc.returns.type!.content,
        knownTypes,
      ).describe(jsdoc.returns.description);
      type.addReturnType(returnType);
    }
    for (const param of jsdoc.params || []) {
      const paramType = typeFromFeatherString(
        param.type!.content,
        knownTypes,
      ).describe(param.description);
      const member = type.addParameter(i, param.name!.content, paramType);
      i++;
      member.optional = !!param.optional;
      member.describe(param.description);
    }
    return type;
  }
  throw new Error(`Unknown JSDoc kind ${jsdoc.kind}`);
}
export function typeFromParsedFeatherString(
  node: FeatherTypeUnion | FeatherType,
  knownTypes: Map<string, Type>,
): Type {
  if (node.kind === 'type') {
    const identifier = node.name;
    let type = typeFromIdentifier(identifier, knownTypes);
    if (node.of) {
      const subtype = typeFromParsedFeatherString(node.of, knownTypes);
      // Then we need to create a new type instead of mutating
      // the one we found.
      type = type.derive();
      if (type.kind.match(/^(Array|Struct|Id.Ds)/)) {
        type.addItemType(subtype);
      }
      // TODO: Else create a diagnostic?
    }
    return type;
  } else if (node.kind === 'union') {
    const unionOf = node.types;
    if (unionOf.length === 1) {
      return typeFromParsedFeatherString(unionOf[0], knownTypes);
    }
    const type = new Type('Union');
    for (const child of unionOf) {
      const subtype = typeFromParsedFeatherString(child, knownTypes);
      type.addUnionType(subtype);
    }
    return type;
  }
  throw new Error(`Unknown node type ${node['name']}`);
}
