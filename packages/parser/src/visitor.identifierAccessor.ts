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
  ReferenceableType,
  fixITokenLocation,
  getType,
} from './project.location.js';
import { isTypeOfKind } from './types.checks.js';
import { MemberSignifier, Type } from './types.js';
import { PrimitiveName } from './types.primitives.js';
import type { GmlSymbolVisitor } from './visitor.js';

export function visitIdentifierAccessor(
  this: GmlSymbolVisitor,
  children: IdentifierAccessorCstChildren,
  ctx: VisitorContext,
): Type {
  const matchingSymbol = this.FIND_ITEM(children.identifier[0].children);
  if (matchingSymbol) {
    matchingSymbol.item.addRef(matchingSymbol.range);
  }
  if (!matchingSymbol) {
    const identifier = identifierFrom(children.identifier[0].children);
    if (identifier) {
      this.PROCESSOR.addDiagnostic(
        'UNDECLARED_GLOBAL_REFERENCE',
        identifier.token,
        `This signifier is not declared anywhere.`,
      );
    }
  }
  let accessing: {
    item?: ReferenceableType;
    range?: Range;
  } = matchingSymbol ?? {};
  const typeStack: Type[] = [
    accessing.item ? getType(accessing.item) : this.UNKNOWN,
  ];
  accessing.range = this.PROCESSOR.range(children.identifier[0].location!);
  const suffixes = sortedAccessorSuffixes(children.accessorSuffixes);

  // Compute useful metadata
  /** If true, then the `new` keyword prefixes this. */
  const usesNew = !!children.New?.length;
  /** If not `undefined`, this is the assignment node */
  const assignment = children.assignment?.[0];
  const assignmentType = this.UPDATED_TYPE_WITH_DOCS(
    assignment?.children.assignmentRightHandSide
      ? this.assignmentRightHandSide(
          assignment.children.assignmentRightHandSide[0].children,
          withCtxKind(ctx, 'assignment'),
        )
      : this.UNKNOWN,
  );

  // For each suffix in turn, try to figure out how it changes the scope,
  // find the corresponding symbol, etc.

  suffixLoop: for (let s = 0; s < suffixes.length; s++) {
    const suffix = suffixes[s];
    const suffixRange = this.PROCESSOR.range(suffix.location!);
    const accessingType: Type =
      (accessing?.item && getType(accessing.item)) || this.UNKNOWN;
    const isLastSuffix = s === suffixes.length - 1;
    switch (suffix.name) {
      case 'arrayMutationAccessorSuffix':
      case 'arrayAccessSuffix':
      case 'mapAccessSuffix':
      case 'gridAccessSuffix':
      case 'listAccessSuffix':
      case 'structAccessSuffix':
        this.visit(suffix.children.expression, ctx);
        const type: Type = accessingType.items || this.UNKNOWN;
        accessing = {
          item: type,
          range: suffixRange,
        };
        typeStack.push(type);
        break;
      case 'dotAccessSuffix':
        // Then we need to change self-scope to be inside
        // the prior struct.
        const dotAccessor = suffix.children;
        const dot = fixITokenLocation(dotAccessor.Dot[0]);
        if (
          isTypeOfKind(accessingType, 'Struct') ||
          isTypeOfKind(accessingType, 'Enum')
        ) {
          this.PROCESSOR.scope.setEnd(dot);
          this.PROCESSOR.pushSelfScope(dot, accessingType, true, {
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
            typeStack.push(this.UNKNOWN);
          } else {
            // Then this identifier should exist in the parent struct
            const propertyIdentifier = identifierFrom(dotAccessor)!;
            const propertyNameLocation = dotAccessor.identifier[0].location!;
            const propertyNameRange =
              this.PROCESSOR.range(propertyNameLocation);
            const existingProperty = accessingType.getMember(
              propertyIdentifier.name,
            );
            if (existingProperty) {
              existingProperty.addRef(propertyNameRange);
              accessing = {
                item: existingProperty,
                range: propertyNameRange,
              };
            } else if (
              !existingProperty &&
              isTypeOfKind(accessingType, 'Struct')
            ) {
              // Then this variable is not yet defined on this struct.
              // We need to add it!
              const newMemberType = isLastSuffix
                ? assignmentType
                : this.UNKNOWN;
              // Add this member to the struct
              const newMember: MemberSignifier = accessingType.addMember(
                propertyIdentifier.name,
                newMemberType,
              );
              newMember.instance = true;
              newMember.addRef(propertyNameRange);
              // If this is the last suffix and this is
              // an assignment, then also set the `def` of the
              // new member.
              if (isLastSuffix && assignment) {
                newMember.definedAt(propertyNameRange);
              }
              accessing = {
                item: newMember,
                range: propertyNameRange,
              };
              typeStack.push(newMemberType);
            } else {
              accessing = {};
              typeStack.push(this.UNKNOWN);
            }
            this.PROCESSOR.scope.setEnd(propertyNameLocation, true);
            this.PROCESSOR.popSelfScope(propertyNameLocation, true);
          }
        } else {
          // TODO: Handle dot accessors for other valid dot-accessible types.
          // But for now, just emit an error for definitenly invalid types.
          const isDotAccessible = (
            [
              'Id.Instance',
              'Asset.GMObject',
              'Any',
              'Unknown',
            ] as PrimitiveName[]
          ).includes(accessingType?.kind!);
          accessing = {};
          typeStack.push(this.UNKNOWN);
          if (!isDotAccessible) {
            this.PROCESSOR.addDiagnostic(
              'INVALID_OPERATION',
              suffix.location!,
              `Type ${accessingType?.toFeatherString()} does not allow dot accessors.`,
            );
          }
          continue suffixLoop;
        }
        break;
      case 'functionArguments':
        // Create the argumentRanges between the parense and each comma
        const argsAndSeps = sortedFunctionCallParts(suffix);
        let argIdx = 0;
        let lastDelimiter: IToken;
        let lastTokenWasDelimiter = true;
        const ranges: FunctionArgRange[] = [];
        argLoop: for (let i = 0; i < argsAndSeps.length; i++) {
          const token = argsAndSeps[i];
          const isSep = 'image' in token;
          if (isSep) {
            fixITokenLocation(token);
            if (token.image === '(') {
              lastDelimiter = token;
              continue argLoop;
            }

            // Otherwise create the range
            // For some reason the end position is the same
            // as the start position for the commas and parens
            // Start on the RIGHT side of the first delimiter

            if (accessing.item) {
              const start = Position.fromCstEnd(
                this.PROCESSOR.file,
                lastDelimiter!,
              );
              // end on the LEFT side of the second delimiter
              const end = Position.fromCstStart(this.PROCESSOR.file, token);
              const funcRange = new FunctionArgRange(
                accessing.item,
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
        // Set the current item to the return type,
        // so that we can chain suffixes.
        const returnType =
          (usesNew && isLastSuffix
            ? accessingType?.constructs
            : accessingType?.returns) || this.UNKNOWN;
        accessing = { item: returnType };
        typeStack.push(returnType);
        // Add the function call to the file for diagnostics
        if (ranges.length) {
          this.PROCESSOR.file.addFunctionCall(ranges);
        }
        break;
      default:
        this.visit(suffix, ctx);
        accessing = { item: this.UNKNOWN };
        typeStack.push(accessing.item as Type);
    }
  }
  return typeStack.at(-1)!;
}
