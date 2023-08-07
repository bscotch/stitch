import { arrayUnwrapped, isArray } from '@bscotch/utility';
import type { IToken } from 'chevrotain';
import type { IdentifierAccessorCstChildren } from '../gml-cst.js';
import { withCtxKind, type VisitorContext } from './parser.js';
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
  fixITokenLocation,
} from './project.location.js';
import {
  getTypeOfKind,
  getTypeStoreOrType,
  normalizeType,
  replaceGenerics,
  updateGenericsMap,
} from './types.checks.js';
import { Type, TypeStore } from './types.js';
import { withableTypes } from './types.primitives.js';
import type { AssignmentInfo, AssignmentVariable } from './visitor.assign.js';
import type { GmlSignifierVisitor } from './visitor.js';

export function visitIdentifierAccessor(
  this: GmlSignifierVisitor,
  children: IdentifierAccessorCstChildren,
  ctx: VisitorContext,
): Type | TypeStore {
  const docs = this.PROCESSOR.consumeJsdoc();
  /** Collection of info for variable assignment, if there is one. */
  const assignment = {
    variable: {} as Partial<AssignmentVariable>,
    rhs: rhsFrom(children.assignment),
    info: {
      ctx,
      docs,
    } as AssignmentInfo,
  };

  /** The type or signifier we're using an accessor on */
  let accessing: {
    type?: Type | TypeStore;
    range?: Range;
  } = {};
  const identifier = identifierFrom(children.identifier[0].children);
  const { name } = identifier || {};
  const initialItem = this.FIND_ITEM(children.identifier[0].children);
  const fullScope = this.PROCESSOR.fullScope;
  const initialType = initialItem?.item
    ? getTypeStoreOrType(initialItem.item)
    : undefined;

  if (initialItem) {
    const type = getTypeStoreOrType(initialItem.item);
    accessing = {
      type: isArray(type) ? type[0] : type,
      range: initialItem.range,
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
      `${identifier.name} looks like a global but is declared anywhere.`,
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
      accessing = {
        type: newMember.type,
        range,
      };
    }
  }

  let lastAccessedType: Type | TypeStore = accessing.type || this.ANY;
  accessing.range = this.PROCESSOR.range(children.identifier[0].location!);
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
        const type = arrayUnwrapped(accessing.type?.items || this.ANY);
        accessing = {
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
        const dottableType = accessing.type
          ? getTypeOfKind(accessing.type, [...withableTypes, 'Enum'])
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
            accessing = {};
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
              accessing = {
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
                accessing = {
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
              accessing = {};
              lastAccessedType = this.ANY;
            }
            this.PROCESSOR.scope.setEnd(propertyNameLocation, true);
            this.PROCESSOR.popSelfScope(propertyNameLocation, true);
          }
        } else {
          // TODO: Handle dot accessors for other valid dot-accessible types.
          // But for now, just emit an error for definitenly invalid types.
          const isDotAccessible =
            getTypeOfKind(accessing.type, ['Any', 'Unknown']) ||
            !accessing.type ||
            (accessing.type instanceof TypeStore &&
              accessing.type.type.length === 0);
          accessing = {};
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
        const functionType = getTypeOfKind(accessing.type, 'Function');

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
        accessing = { type: returnType };
        lastAccessedType = returnType;
        // Add the function call to the file for diagnostics
        if (ranges.length) {
          this.PROCESSOR.file.addFunctionCall(ranges);
        }
        break;
      default:
        this.visit(suffix, ctx);
        accessing = { type: this.ANY };
        lastAccessedType = accessing.type as Type;
    }
  }
  return lastAccessedType;
}
