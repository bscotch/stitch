import { arrayWrapped } from '@bscotch/utility';
import {
  parseFeatherTypeString,
  type FeatherType,
  type FeatherTypeUnion,
} from './jsdoc.feather.js';
import type { JsdocSummary } from './jsdoc.js';
import { Type } from './types.js';
import { primitiveNames } from './types.primitives.js';
import { ok } from './util.js';

export type KnownTypesMap = Map<string, Type>;
export type GenericsMap = Record<string, Type[]>;
export type KnownOrGenerics = KnownTypesMap | GenericsMap;

function findInKnownOrGenerics(
  identifier: string,
  knownTypes: KnownTypesMap | KnownOrGenerics[],
): Type[] | undefined {
  const collections = arrayWrapped(knownTypes);
  for (const collection of collections) {
    let found: Type | Type[] | undefined;
    if (collection instanceof Map) {
      found = collection.get(identifier);
    } else {
      found = collection[identifier];
    }
    if (found) {
      return arrayWrapped(found);
    }
  }
  return;
}

export function typeFromFeatherString(
  typeString: string,
  knownTypes: KnownTypesMap | KnownOrGenerics[],
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
  knownTypes: KnownTypesMap | KnownOrGenerics[],
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

  const knownType = findInKnownOrGenerics(identifier, knownTypes)?.[0];
  if (knownType && isObjectType) {
    // Need a derived type to prevent mutation of the parent!
    return knownType.derive();
  } else if (knownType) {
    return knownType;
  }

  const primitiveType = primitiveNames.find(
    (n) => n?.toLocaleLowerCase?.() === normalizedName,
  );
  if (primitiveType) {
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
        const map = arrayWrapped(knownTypes).find(
          (collection) => collection instanceof Map,
        ) as KnownTypesMap | undefined;
        map?.set(identifier, derivedTyped);
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
    const generics: Record<string, Type[]> = {};
    for (const generic of jsdoc.templates || []) {
      generics[generic.name!.content] = typeFromFeatherString(
        generic.type?.content || 'Any',
        knownTypes,
        addMissing,
      );
      // Flag them all as generic, named after the generic name
      for (const genericType of generics[generic.name!.content]) {
        genericType.isGeneric = true;
        genericType.named(generic.name!.content);
      }
    }
    if (jsdoc.self) {
      type.self = typeFromFeatherString(
        jsdoc.self!.content,
        knownTypes,
        addMissing,
      )[0] as Type<any>;
    }
    if (jsdoc.returns && jsdoc.returns.type) {
      const returnType = typeFromFeatherString(
        jsdoc.returns.type.content,
        [knownTypes, generics],
        addMissing,
      );
      type.addReturnType(returnType);
    }
    for (const param of jsdoc.params || []) {
      const member = type.addParameter(i, param.name!.content);
      if (param.type) {
        member.setType(
          typeFromFeatherString(
            param.type.content,
            [knownTypes, generics],
            addMissing,
          ),
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
  knownTypes: KnownTypesMap | KnownOrGenerics[],
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
      // While only some types are "containers", we can
      // go ahead and add any contained types and worry
      // about the consequences later. That way we don't
      // need to keep updating this as we add more container
      // types.
      for (const subtype of subtypes) {
        type.addItemType(subtype);
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
