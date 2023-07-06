import { arrayUnwrapped, isArray } from '@bscotch/utility';
import type { IToken } from 'chevrotain';
import type { IdentifierAccessorCstChildren } from '../gml-cst.js';
import {
  identifierFrom,
  isEmpty,
  sortedAccessorSuffixes,
  sortedFunctionCallParts,
  withCtxKind,
  type VisitorContext,
} from './parser.js';
import {
  FunctionArgRange,
  Position,
  Range,
  fixITokenLocation,
} from './project.location.js';
import { Signifier } from './signifiers.js';
import {
  getTypeOfKind,
  getTypeStoreOrType,
  isTypeOrStoreOfKind,
} from './types.checks.js';
import { Type, TypeStore } from './types.js';
import type { GmlSignifierVisitor } from './visitor.js';

export function visitIdentifierAccessor(
  this: GmlSignifierVisitor,
  children: IdentifierAccessorCstChildren,
  ctx: VisitorContext,
): Type | TypeStore {
  /** The type or signifier we're using an accessor on */
  let accessing: {
    type?: Type | TypeStore;
    range?: Range;
  } = {};
  const initialSignifier = this.FIND_ITEM(children.identifier[0].children);
  if (initialSignifier) {
    const type = getTypeStoreOrType(initialSignifier.item);
    accessing = {
      type: isArray(type) ? type[0] : type,
      range: initialSignifier.range,
    };
    if ('addRef' in initialSignifier.item) {
      initialSignifier.item.addRef(initialSignifier.range);
    }
  } else {
    // Add a diagnostic for the identifier
    const identifier = identifierFrom(children.identifier[0].children);
    if (identifier) {
      this.PROCESSOR.addDiagnostic(
        'UNDECLARED_GLOBAL_REFERENCE',
        identifier.token,
        `${identifier.name} is not declared anywhere.`,
      );
    }
  }

  let lastAccessedType: Type | TypeStore = accessing.type || this.ANY;
  accessing.range = this.PROCESSOR.range(children.identifier[0].location!);
  const suffixes = sortedAccessorSuffixes(children.accessorSuffixes);

  // Compute useful metadata
  /** If true, then the `new` keyword prefixes this. */
  const usesNew = !!children.New?.length;
  /** If not `undefined`, this is the assignment node */
  const docs = this.PROCESSOR.consumeJsdoc();
  const assignmentCst =
    children.assignment?.[0]?.children.assignmentRightHandSide?.[0].children;
  const inferredType = assignmentCst
    ? this.assignmentRightHandSide(
        assignmentCst,
        withCtxKind(ctx, 'assignment'),
      )
    : this.ANY;

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
          ? getTypeOfKind(accessing.type, ['Struct', 'Enum'])
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
              existingProperty.addRef(propertyNameRange);
              accessing = {
                type: existingProperty.type,
                range: propertyNameRange,
              };
              lastAccessedType = existingProperty.type;
              // On update, we need to make sure that the definition
              // still exists.
              if (isLastSuffix && assignmentCst && !existingProperty.def) {
                existingProperty.definedAt(propertyNameRange);
                if (docs) {
                  existingProperty.describe(docs.jsdoc.description);
                  existingProperty.setType(docs.type);
                } else if (inferredType) {
                  existingProperty.setType(inferredType);
                }
              }
            } else if (
              !existingProperty &&
              isTypeOrStoreOfKind(accessing.type, 'Struct')
            ) {
              // Then this variable is not yet defined on this struct.
              // We need to add it!
              const accessingStruct = getTypeOfKind(accessing.type, 'Struct')!;
              const newMember: Signifier = accessingStruct.addMember(
                propertyIdentifier.name,
              );
              newMember.instance = true;
              newMember.addRef(propertyNameRange);
              // If this is the last suffix and this is
              // an assignment, then also set the `def` of the
              // new member.
              if (isLastSuffix && assignmentCst) {
                newMember.definedAt(propertyNameRange);
                if (docs) {
                  newMember.describe(docs.jsdoc.description);
                  newMember.setType(docs.type);
                } else if (inferredType) {
                  newMember.setType(inferredType);
                }
              }
              accessing = {
                type: newMember.type,
                range: propertyNameRange,
              };
              lastAccessedType = newMember.type;
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
          const isDotAccessible = getTypeOfKind(accessing.type, [
            'Id.Instance',
            'Asset.GMObject',
            'Any',
            'Unknown',
          ]);
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
        // Create the argumentRanges between the parens and each comma
        const argsAndSeps = sortedFunctionCallParts(suffix);
        let argIdx = 0;
        let lastDelimiter: IToken;
        let lastTokenWasDelimiter = true;
        const functionType = getTypeOfKind(accessing.type, 'Function');
        const ranges: FunctionArgRange[] = [];
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
            this.assignmentRightHandSide(
              token.children.assignmentRightHandSide[0].children,
              withCtxKind(ctx, 'functionArg'),
            );
          }
        }
        // The returntype of this function may be used in another accessor
        const returnType =
          (usesNew && isLastSuffix
            ? functionType?.constructs
            : functionType?.returns) || this.ANY;
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
