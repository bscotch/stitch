import { Defined, arrayUnwrapped, arrayWrapped, isArray } from '@bscotch/utility';
import type { IToken } from 'chevrotain';
import type { AccessorSuffixesCstChildren, AssignmentRightHandSideCstChildren, DotAccessSuffixCstNode, FunctionArgumentsCstNode, IdentifierAccessorCstChildren } from '../gml-cst.js';
import { Docs, withCtxKind, type VisitorContext } from './parser.js';
import {
  identifierFrom,
  isEmpty,
  rhsFrom,
  sortedAccessorSuffixes,
  sortedFunctionCallParts,
} from './parser.utility.js';
import {
  FunctionArgRange,
  Position,
  Range,
  fixITokenLocation
} from './project.location.js';
import type { Signifier } from './signifiers.js';
import {
  getTypeOfKind,
  getTypeStoreOrType,
  getTypesOfKind,
  isTypeOfKind,
  normalizeType,
  replaceGenerics,
  updateGenericsMap,
} from './types.checks.js';
import { EnumType, Type, TypeStore, WithableType } from './types.js';
import { withableTypes } from './types.primitives.js';
import { Values } from './util.js';
import { assignVariable, type AssignmentInfo, type AssignmentVariable } from './visitor.assign.js';
import type { GmlSignifierVisitor } from './visitor.js';

interface LastAccessed {
  /** If we're accessing a named variable, this is that name */
  name?: string;
  /** If we're accessing a signifier, this is it */
  signifier?: Signifier;
  /** The range of the name last accessed */
  range: Range;
  /** The types from the thing we accessed */
  types?: Type[] | TypeStore[];
  scope?: WithableType | EnumType;
  /** If this is an assignment, what we're assigning to */
  rhs?: AssignmentRightHandSideCstChildren;
  /** If the `new` keyword prefixed the accessor */
  usesNew?: boolean;
  /** The original context provided prior to the accessor chain */
  ctx: VisitorContext;
  /** The JSDocs consumed prior to the accessor chain */
  docs?: Docs;
}

type AccessorNode = Defined<Values<AccessorSuffixesCstChildren>>[number];

export function visitIdentifierAccessor(
  this: GmlSignifierVisitor,
  children: IdentifierAccessorCstChildren,
  ctx: VisitorContext,): Type[] |TypeStore[] {
  const docs = this.PROCESSOR.consumeJsdoc();
  const suffixes = sortedAccessorSuffixes(children.accessorSuffixes);
    // Compute useful metadata
  /** If true, then the `new` keyword prefixes this. */
  const usesNew = !!children.New?.length;
  /** If not `undefined`, this is the assignment node */
  const rhs = rhsFrom(children.assignment);
  const scope = this.PROCESSOR.fullScope;

  // Use the starting identifier to construct the initial `lastAccessed` object
  let lastAccessed: LastAccessed = {
    name: identifierFrom(children.identifier[0].children)?.name,
    range: Range.fromCst(this.PROCESSOR.file, children.identifier[0].location!),
    usesNew,
    ctx
  }

  // Early exit if we don't have a name, since that should only
  // happen in a broken state (e.g. during editing)
  if (!lastAccessed.name) return [this.ANY]

  // See if this is a known identifier. If not, create it in an
  // "undeclared" state.
  let item = this.FIND_ITEM(children.identifier[0].children)?.item;
  if (!item && scope.self === scope.global) {
    // Then this is being treated as a global variable but it has
    // not been declared anywhere
    this.PROCESSOR.addDiagnostic(
      'UNDECLARED_GLOBAL_REFERENCE',
      lastAccessed.range,
      `${lastAccessed.name} looks like a global but is not declared anywhere.`,
    );
    // Just set the last accessed type to ANY so that we can
    // continue processing.
    lastAccessed.types = [this.ANY];
  } else if (!item) {
    // Then this is a signifier that we have not seen declared yet,
    // but might be declared later. So add it to the self scope but
    // without setting where it's defined. Diagnostics should be added
    // later.
    item = scope.self.addMember(lastAccessed.name);
    if (item) {
      item.instance = true;
    }
  }

  // Update lastAccessed with the signifier info
  if (item?.$tag === 'Sym') {
    lastAccessed.signifier = item;
    lastAccessed.scope = item.parent as WithableType | EnumType;
    lastAccessed.types = arrayWrapped(getTypeStoreOrType(item));
    // Add a reference! But if this is an assignment that'll be
    // handled later.
    if (!rhs) {
      item.addRef(lastAccessed.range);
    }
  }

  // Now that we have the initial "lastAccessed" content,
  // we can iterate over the accessors.
  for (let i = 0; i < suffixes.length; i++) {
    // If this is the final suffix, we need to pass additional
    // info that is applicable to it.
    if (i === suffixes.length - 1) {
      lastAccessed.rhs = rhs;
      lastAccessed.docs = docs; 
    }
    lastAccessed = processNextAccessor(this,lastAccessed, suffixes[i], suffixes[i + 1]); 
  }

  return lastAccessed.types || [this.ANY];
}

/**
 * @param nextAccessor If there is another accessor after this one, having it as a lookahead is useful in some cases. */
function processNextAccessor(
  visitor: GmlSignifierVisitor, lastAccessed: LastAccessed, accessor: AccessorNode,
  nextAccessor?: AccessorNode
): LastAccessed {
  // Many suffix cases include an expression we need to evaluate.
  // For example, `hello[expression]`
  const accessorExpressionType = 'expression' in accessor.children ? visitor.visit(accessor.children.expression, lastAccessed.ctx) : visitor.ANY;

  let nextAccessed: LastAccessed;

  switch (accessor.name) {
    case 'arrayMutationAccessorSuffix':
    case 'arrayAccessSuffix':
    case 'mapAccessSuffix':
    case 'gridAccessSuffix':
    case 'listAccessSuffix':
    case 'structAccessSuffix':
      // All of the above are container types, so we need to
      // return the type of the items in the container. First
      // restrict the incoming types to those that are supported
      // by the accessor type.
      const allowedTypes = getTypesOfKind(lastAccessed.types,
        accessor.name.startsWith('array')
          ? 'Array'
          : accessor.name === 'mapAccessSuffix'
            ? 'Id.DsMap'
            : accessor.name === 'gridAccessSuffix'
              ? 'Id.DsGrid'
              : accessor.name === 'listAccessSuffix'
                ? 'Id.DsList'
                : accessor.name === 'structAccessSuffix'
                  ? 'Struct'
                  : 'Any'
      );
      nextAccessed = {
            range: Range.fromCst(visitor.PROCESSOR.file, accessor.location!),
    ctx: lastAccessed.ctx,
      }
      nextAccessed.types = allowedTypes.map(t => t.items).filter(t => !!t) as TypeStore[];
      break;
    case 'dotAccessSuffix':
      nextAccessed = processDotAccessor(visitor, lastAccessed, accessor, nextAccessor);
      break;
    case 'functionArguments':
      nextAccessed = processFunctionArguments(visitor, lastAccessed, accessor);
      break;
  }

  return nextAccessed;
}

function processFunctionArguments(visitor: GmlSignifierVisitor, lastAccessed: LastAccessed, suffix: FunctionArgumentsCstNode):LastAccessed {
  const nextAccessed: LastAccessed = {
    range: Range.fromCst(visitor.PROCESSOR.file, suffix.location!),
    ctx: lastAccessed.ctx,
  }

  // Get the first function type from the lastAccessed types
  const functionType = getTypeOfKind(lastAccessed.types, 'Function');

  // If this is a mixin call, then we need to ensure that the context
  // includes the variables created by the mixin function.
  if (functionType?.signifier?.mixin && functionType.self) {
    const variables = functionType.self;
    for (const member of variables.listMembers()) {
      if (!member.def) continue;
      member.override = true; // Ensure it's set as an override variable
      const currentMember = visitor.PROCESSOR.currentSelf.getMember(
        member.name,
      );
      if (currentMember?.native) continue;
      visitor.PROCESSOR.currentSelf.addMember(member);
    }
  }

  /**
   * The native `method` function has the unique property
   * of causing its first argument to be used as the scope
   * for the second argument.
   */
  const isMethodCall =
    functionType?.signifier ===
    visitor.PROCESSOR.project.self.getMember('method');
  let methodSelf: Type | undefined;
  /** If this is a `method()` call, the 2nd argument is the return type */
  let methodReturns: Type | undefined;

  // Create the argumentRanges between the parens and each comma
  const argsAndSeps = sortedFunctionCallParts(suffix);
  let argIdx = 0;
  let lastDelimiter: IToken;
  let lastTokenWasDelimiter = true;
  const ranges: FunctionArgRange[] = [];
  const generics = new Map<string, TypeStore>();

  for (let i = 0; i < argsAndSeps.length; i++) {
    const token = argsAndSeps[i];
    const isSep = 'image' in token;
    if (isSep) {
      fixITokenLocation(token);
      if (token.image === '(') {
        lastDelimiter = token;
        continue;
      }

      // Otherwise create the range
      // For some reason the end position is the same
      // as the start position for the commas and parens
      // Start on the RIGHT side of the first delimiter

      if (functionType) {
        const start = Position.fromCstEnd(
          visitor.PROCESSOR.file,
          lastDelimiter!,
        );
        // end on the LEFT side of the second delimiter
        const end = Position.fromCstStart(visitor.PROCESSOR.file, token);
        const funcRange = new FunctionArgRange(
          functionType,
          argIdx,
          start,
          end,
        );
        if (!lastTokenWasDelimiter) {
          funcRange.hasExpression = true;
        }
        visitor.PROCESSOR.file.addFunctionArgRange(funcRange);
        ranges.push(funcRange);
      }

      // Increment the argument idx for the next one
      lastDelimiter = token;
      lastTokenWasDelimiter = true;
      argIdx++;
    } else {
      lastTokenWasDelimiter = false;
      const functionCtx = withCtxKind(lastAccessed.ctx, 'functionArg');
      if (isMethodCall && argIdx === 1 && methodSelf) {
        functionCtx.self = methodSelf;
      }
      const expectedType = functionType?.getParameter(argIdx);
      const inferredType = normalizeType(
        visitor.assignmentRightHandSide(
          token.children.assignmentRightHandSide[0].children,
          functionCtx,
        ),
        visitor.PROCESSOR.project.types,
      );
      if (isMethodCall && argIdx === 1) {
        // Then the inferred argument type is the return type
        methodReturns = getTypeOfKind(inferredType, ['Function']);
      }
      if (expectedType) {
        updateGenericsMap(
          expectedType,
          inferredType,
          visitor.PROCESSOR.project.types,
          generics,
        );
      }
      if (isMethodCall && argIdx === 0) {
        methodSelf = getTypeOfKind(inferredType, [
          'Id.Instance',
          'Struct',
          'Asset.GMObject',
        ]);
      }
    }
  }
  // The returntype of this function may be used in another accessor
  const returnType = normalizeType(
    replaceGenerics(
      (lastAccessed.usesNew
        ? functionType?.self
        : isMethodCall
        ? methodReturns
        : functionType?.returns) || visitor.ANY,
      visitor.PROCESSOR.project.types,
      generics,
    ),
    visitor.PROCESSOR.project.types,
  );
  nextAccessed.types = [returnType];
  // Add the function call to the file for diagnostics
  if (ranges.length) {
    visitor.PROCESSOR.file.addFunctionCall(ranges);
  }

  return nextAccessed;
}

function processDotAccessor(visitor: GmlSignifierVisitor, lastAccessed: LastAccessed, accessor: DotAccessSuffixCstNode, nextAccessor?: AccessorNode): LastAccessed {
  const nextAccessed: LastAccessed = {
    range: Range.fromCst(visitor.PROCESSOR.file, accessor.location!),
    ctx: lastAccessed.ctx,
  }
  
  // Reduce the available types from lastAccessed to those that
  // are dot-accessible
  const dottableTypes = getTypesOfKind(lastAccessed.types, [...withableTypes, 'Enum']);

  if (!dottableTypes.length) {
    // Early return. Just set the type to ANY and move along.
    nextAccessed.types = [visitor.ANY];
    const isDotAccessible = !lastAccessed.types?.length || getTypeOfKind(lastAccessed.types, ['Any', 'Unknown', 'Mixed']);
    if (!isDotAccessible) {
      visitor.PROCESSOR.addDiagnostic(
        'INVALID_OPERATION',
        accessor.location!,
        `Type does not allow dot accessors.`,
      );
    }
    return nextAccessed;
  }


  let dottableType = dottableTypes[0];
  if (dottableTypes.length > 1) {
    // We may have a union of valid types, so it's helpful to know
    // the subsequent accessor (if there is one) -- we can use it
    // to narrow down which type is likely intended.
    const nextAccessorName = nextAccessor?.name === 'dotAccessSuffix' ? identifierFrom(nextAccessor.children.identifier)?.name : undefined;
    if (nextAccessorName) {
      dottableType = dottableTypes.find(t => t.getMember(nextAccessorName)) || dottableType;
    }
  }

  // Then we need to change self-scope to be inside
  // the prior dot-accessible.
  const dotAccessor = accessor.children;
  const dot = fixITokenLocation(dotAccessor.Dot[0]);

  // Set the self-scope starting right after the dot operator
  visitor.PROCESSOR.scope.setEnd(dot);
  visitor.PROCESSOR.pushSelfScope(dot, dottableType, true, {
    accessorScope: true,
  });

  // While editing a user will dot into something
  // prior to actually adding the new identifier.
  // To provide autocomplete options, we need to
  // still add a scopeRange for the dot.
  const hasIdentifier = !isEmpty(dotAccessor.identifier[0].children);
  if (!hasIdentifier) {
    visitor.PROCESSOR.scope.setEnd(dot, true);
    visitor.PROCESSOR.popSelfScope(dot, true);
    nextAccessed.types = [visitor.ANY];
    return nextAccessed;
  }

  // Then we've got an identifier! Get its info.
  const propertyIdentifier = identifierFrom(dotAccessor)!;
  const propertyNameLocation = dotAccessor.identifier[0].location!;
  const propertyNameRange =
    visitor.PROCESSOR.range(propertyNameLocation);
  nextAccessed.range = propertyNameRange;
  nextAccessed.name = propertyIdentifier.name;
  
  // If we have an existing property, we just need to add
  // a ref and update the nextAccessed info. If not, we'll
  // need to first create that property.
  
  let property = dottableType.getMember(
    propertyIdentifier.name,
  );
  if (property) {
    // If there's an assignment and this isn't an enum, then
    // handle then offload to the assignment logic
    if (lastAccessed.rhs && !isTypeOfKind(dottableType, "Enum") && !property.def) {
      property = assignVariable(visitor, { name: propertyIdentifier.name, container: dottableType, range: propertyNameRange }, lastAccessed.rhs, {
        ctx: lastAccessed.ctx,
        docs: lastAccessed.docs,
        instance: true
      })?.item || property;
    }
    else {
      // Otherwise we'll need to manually add the reference
      property.addRef(propertyNameRange);
    }
  } else if (dottableType.kind === 'Enum') {
    // Then we're trying to get an enum member that doesn't exist!
    visitor.PROCESSOR.addDiagnostic(
      'INVALID_OPERATION',
      accessor.location!,
      `Undefined enum member.`,
    );
  }
  else if (lastAccessed.rhs) {
    // Then this variable is not yet defined on this struct,
    // but we have an assignment operation to use to define it.
    property = assignVariable(visitor, { name: propertyIdentifier.name, container: dottableType as WithableType, range: propertyNameRange }, lastAccessed.rhs, {
      ctx: lastAccessed.ctx,
      docs: lastAccessed.docs,
      instance: true
    })?.item;
  }
  else {
    // Then this variable is not yet defined on this struct.
    // We need to add it! If this is an assignment operation, then
    // we can use the central assignment logic. Otherwise we just
    // need to add an "undeclared" variable to the current type.
    property = dottableType.addMember(propertyIdentifier.name);
    if (property) {
      property.instance = true;
      property.addRef(propertyNameRange);
    } else {
      visitor.PROCESSOR.addDiagnostic(
        'INVALID_OPERATION',
        accessor.location!,
        `Unknown property.`,
      );
    }
  }
  visitor.PROCESSOR.scope.setEnd(propertyNameLocation, true);
  visitor.PROCESSOR.popSelfScope(propertyNameLocation, true);
  nextAccessed.signifier = property;
  nextAccessed.types = arrayWrapped(property?.type || visitor.ANY)
  return nextAccessed;
}


function visitIdentifierAccessorOld(
  this: GmlSignifierVisitor,
  children: IdentifierAccessorCstChildren,
  ctx: VisitorContext,
): Type | TypeStore {
  const docs = this.PROCESSOR.consumeJsdoc();
  /** Collection of info for variable assignment, if there is one. */
  const assignment = {
    variable: {} as Partial<AssignmentVariable> & { type?: Type | TypeStore },
    rhs: rhsFrom(children.assignment),
    info: {
      ctx,
      docs,
    } as AssignmentInfo,
  };

  const identifier = identifierFrom(children.identifier[0].children);
  const { name } = identifier || {};
  const initialItem = this.FIND_ITEM(children.identifier[0].children);
  const fullScope = this.PROCESSOR.fullScope;
  const initialType = initialItem?.item
    ? getTypeStoreOrType(initialItem.item)
    : undefined;

  if (initialItem) {
    const type = getTypeStoreOrType(initialItem.item);
    assignment.variable = {
      name,
      type: isArray(type) ? type[0] : type,
      range: initialItem.range,
      container: 'parent' in initialItem.item ? initialItem.item.parent as WithableType : undefined,
    };
    if ('addRef' in initialItem.item) {
      initialItem.item.addRef(initialItem.range);
    }
  } else if (fullScope.self === fullScope.global && identifier) {
    // Then this is being treated as a global variable but it has
    // not been declared anywhere
    this.PROCESSOR.addDiagnostic(
      'UNDECLARED_GLOBAL_REFERENCE',
      identifier.token,
      `${identifier.name} looks like a global but is not declared anywhere.`,
    );
  } else if (fullScope.self !== fullScope.global && name) {
    // Then this is a signifier that we have not seen declared yet,
    // but might be declared later. So add it to the self scope but
    // without setting where it's defined. Diagnostics should be added
    // later.
    const range = this.PROCESSOR.range(children.identifier[0].location!);
    const newMember = fullScope.self.addMember(name);
    if (newMember) {
      newMember.addRef(range);
      newMember.instance = true;
      assignment.variable = {
        name,
        type: newMember.type,
        range,
      container: fullScope.self as WithableType,
      };
    }
  }

  let lastAccessedType: Type | TypeStore = assignment.variable.type || this.ANY;
  assignment.variable.range = this.PROCESSOR.range(children.identifier[0].location!);
  const suffixes = sortedAccessorSuffixes(children.accessorSuffixes);

  // Compute useful metadata
  /** If true, then the `new` keyword prefixes this. */
  const usesNew = !!children.New?.length;
  /** If not `undefined`, this is the assignment node */
  const rhs = rhsFrom(children.assignment);
  const inferredType = normalizeType(
    rhs
      ? this.assignmentRightHandSide(rhs, withCtxKind(ctx, 'assignment'))
      : initialType || this.ANY,
    this.PROCESSOR.project.types,
  );

  // For each suffix in turn, try to figure out how it changes the scope,
  // find the corresponding symbol, etc.

  for (let s = 0; s < suffixes.length; s++) {
    const suffix = suffixes[s];
    const suffixRange = this.PROCESSOR.range(suffix.location!);
    const isLastSuffix = s === suffixes.length - 1;
    switch (suffix.name) {
      case 'arrayMutationAccessorSuffix':
      case 'arrayAccessSuffix':
      case 'mapAccessSuffix':
      case 'gridAccessSuffix':
      case 'listAccessSuffix':
      case 'structAccessSuffix':
        this.visit(suffix.children.expression, ctx);
        const type = arrayUnwrapped(assignment.variable.type?.items || this.ANY);
        assignment.variable = {
          type: type,
          range: suffixRange,
        };
        lastAccessedType = type;
        break;
      case 'dotAccessSuffix':
        // Then we need to change self-scope to be inside
        // the prior dot-accessible.
        const dotAccessor = suffix.children;
        const dot = fixITokenLocation(dotAccessor.Dot[0]);
        const dottableType = assignment.variable.type
          ? getTypeOfKind(assignment.variable.type, [...withableTypes, 'Enum'])
          : undefined;
        if (dottableType) {
          this.PROCESSOR.scope.setEnd(dot);
          this.PROCESSOR.pushSelfScope(dot, dottableType, true, {
            accessorScope: true,
          });
          // While editing a user will dot into something
          // prior to actually adding the new identifier.
          // To provide autocomplete options, we need to
          // still add a scopeRange for the dot.
          if (isEmpty(dotAccessor.identifier[0].children)) {
            this.PROCESSOR.scope.setEnd(dot, true);
            this.PROCESSOR.popSelfScope(dot, true);
            assignment.variable = {};
            lastAccessedType = this.ANY;
          } else {
            // Then this identifier should exist in the parent struct
            const propertyIdentifier = identifierFrom(dotAccessor)!;
            const propertyNameLocation = dotAccessor.identifier[0].location!;
            const propertyNameRange =
              this.PROCESSOR.range(propertyNameLocation);
            const existingProperty = dottableType.getMember(
              propertyIdentifier.name,
            );
            if (existingProperty) {
              const ref = existingProperty.addRef(propertyNameRange);
              assignment.variable = {
                type: existingProperty.type,
                range: propertyNameRange,
              };
              lastAccessedType = existingProperty.type;
              // On update, we need to make sure that the definition
              // still exists.
              if (isLastSuffix && rhs && !existingProperty.def) {
                existingProperty.definedAt(propertyNameRange);
                ref.isDef = true;
                if (docs) {
                  existingProperty.describe(docs.jsdoc.description);
                  existingProperty.setType(docs.type);
                } else if (inferredType) {
                  existingProperty.setType(inferredType);
                }
              }
            } else if (!existingProperty && dottableType.kind !== 'Enum') {
              // Then this variable is not yet defined on this struct.
              // We need to add it!
              const newMember = dottableType.addMember(propertyIdentifier.name);
              if (newMember) {
                newMember.instance = true;
                const ref = newMember.addRef(propertyNameRange);
                // If this is the last suffix and this is
                // an assignment, then also set the `def` of the
                // new member.
                if (isLastSuffix && rhs) {
                  newMember.definedAt(propertyNameRange);
                  ref.isDef = true;
                  if (docs) {
                    newMember.describe(docs.jsdoc.description);
                    newMember.setType(docs.type);
                  } else if (inferredType) {
                    newMember.setType(inferredType);
                  }
                }
                // Else if this is a struct without any type info,
                // allow it to be "defined" since the user has no opinions about its existence.
                // TODO: This should probably be an OPTION
                else if (
                  dottableType.totalMembers() === 0 &&
                  !dottableType.items?.type.length
                ) {
                  newMember.def = {}; // Prevents "Undeclared" errors
                }
                assignment.variable = {
                  type: newMember.type,
                  range: propertyNameRange,
                };
                lastAccessedType = newMember.type;
              } else {
                this.PROCESSOR.addDiagnostic(
                  'INVALID_OPERATION',
                  suffix.location!,
                  `Unknown property.`,
                );
              }
            } else {
              assignment.variable = {};
              lastAccessedType = this.ANY;
            }
            this.PROCESSOR.scope.setEnd(propertyNameLocation, true);
            this.PROCESSOR.popSelfScope(propertyNameLocation, true);
          }
        } else {
          // TODO: Handle dot accessors for other valid dot-accessible types.
          // But for now, just emit an error for definitenly invalid types.
          const isDotAccessible =
            getTypeOfKind(assignment.variable.type, ['Any', 'Unknown']) ||
            !assignment.variable.type ||
            (assignment.variable.type instanceof TypeStore &&
              assignment.variable.type.type.length === 0);
          assignment.variable = {};
          lastAccessedType = this.ANY;
          if (!isDotAccessible) {
            this.PROCESSOR.addDiagnostic(
              'INVALID_OPERATION',
              suffix.location!,
              `Type does not allow dot accessors.`,
            );
          }
          continue;
        }
        break;
      case 'functionArguments':
        const functionType = getTypeOfKind(assignment.variable.type, 'Function');

        // If this is a mixin call, then we need to ensure that the context
        // includes the variables created by the mixin function.
        if (functionType?.signifier?.mixin && functionType.self) {
          const variables = functionType.self;
          for (const member of variables.listMembers()) {
            if (!member.def) continue;
            member.override = true; // Ensure it's set as an override variable
            const currentMember = this.PROCESSOR.currentSelf.getMember(
              member.name,
            );
            if (currentMember?.native) continue;
            this.PROCESSOR.currentSelf.addMember(member);
          }
        }

        /**
         * The native `method` function has the unique property
         * of causing its first argument to be used as the scope
         * for the second argument.
         */
        const isMethodCall =
          functionType?.signifier ===
          this.PROCESSOR.project.self.getMember('method');
        let methodSelf: Type | undefined;
        /** If this is a `method()` call, the 2nd argument is the return type */
        let methodReturns: Type | undefined;

        // Create the argumentRanges between the parens and each comma
        const argsAndSeps = sortedFunctionCallParts(suffix);
        let argIdx = 0;
        let lastDelimiter: IToken;
        let lastTokenWasDelimiter = true;
        const ranges: FunctionArgRange[] = [];
        const generics = new Map<string, TypeStore>();

        for (let i = 0; i < argsAndSeps.length; i++) {
          const token = argsAndSeps[i];
          const isSep = 'image' in token;
          if (isSep) {
            fixITokenLocation(token);
            if (token.image === '(') {
              lastDelimiter = token;
              continue;
            }

            // Otherwise create the range
            // For some reason the end position is the same
            // as the start position for the commas and parens
            // Start on the RIGHT side of the first delimiter

            if (functionType) {
              const start = Position.fromCstEnd(
                this.PROCESSOR.file,
                lastDelimiter!,
              );
              // end on the LEFT side of the second delimiter
              const end = Position.fromCstStart(this.PROCESSOR.file, token);
              const funcRange = new FunctionArgRange(
                functionType,
                argIdx,
                start,
                end,
              );
              if (!lastTokenWasDelimiter) {
                funcRange.hasExpression = true;
              }
              this.PROCESSOR.file.addFunctionArgRange(funcRange);
              ranges.push(funcRange);
            }

            // Increment the argument idx for the next one
            lastDelimiter = token;
            lastTokenWasDelimiter = true;
            argIdx++;
          } else {
            lastTokenWasDelimiter = false;
            const functionCtx = withCtxKind(ctx, 'functionArg');
            if (isMethodCall && argIdx === 1 && methodSelf) {
              functionCtx.self = methodSelf;
            }
            const expectedType = functionType?.getParameter(argIdx);
            const inferredType = normalizeType(
              this.assignmentRightHandSide(
                token.children.assignmentRightHandSide[0].children,
                functionCtx,
              ),
              this.PROCESSOR.project.types,
            );
            if (isMethodCall && argIdx === 1) {
              // Then the inferred argument type is the return type
              methodReturns = getTypeOfKind(inferredType, ['Function']);
            }
            if (expectedType) {
              updateGenericsMap(
                expectedType,
                inferredType,
                this.PROCESSOR.project.types,
                generics,
              );
            }
            if (isMethodCall && argIdx === 0) {
              methodSelf = getTypeOfKind(inferredType, [
                'Id.Instance',
                'Struct',
                'Asset.GMObject',
              ]);
            }
          }
        }
        // The returntype of this function may be used in another accessor
        const returnType = normalizeType(
          replaceGenerics(
            (usesNew && isLastSuffix
              ? functionType?.self
              : isMethodCall
              ? methodReturns
              : functionType?.returns) || this.ANY,
            this.PROCESSOR.project.types,
            generics,
          ),
          this.PROCESSOR.project.types,
        );
        assignment.variable = { type: returnType };
        lastAccessedType = returnType;
        // Add the function call to the file for diagnostics
        if (ranges.length) {
          this.PROCESSOR.file.addFunctionCall(ranges);
        }
        break;
      default:
        this.visit(suffix, ctx);
        assignment.variable = { type: this.ANY };
        lastAccessedType = assignment.variable.type as Type;
    }
  }
  return lastAccessedType;
}
