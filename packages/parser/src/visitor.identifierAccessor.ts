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
  ReferenceableType,
  fixITokenLocation,
  getType,
  type Reference,
} from './project.location.js';
import { isTypeOfKind } from './types.checks.js';
import { Type, TypeMember } from './types.js';
import { PrimitiveName } from './types.primitives.js';
import { assert, ok } from './util.js';
import type { GmlSymbolVisitor } from './visitor.js';

export function visitIdentifierAccessor(
  this: GmlSymbolVisitor,
  children: IdentifierAccessorCstChildren,
  ctx: VisitorContext,
): Type {
  const identity = identifierFrom(children);
  /** The type that this node evaluates to as an expression. */
  let finalType: Type = this.UNKNOWN;
  let currentItem:
    | {
        item: ReferenceableType;
        ref?: Reference<ReferenceableType>;
      }
    | undefined = this.identifier(children.identifier[0].children, ctx);
  if (!currentItem) {
    if (identity) {
      this.PROCESSOR.addDiagnostic(
        children.identifier[0].location!,
        `Unknown identifier`,
        'error',
      );
    }
    return finalType;
  } else {
    finalType = getType(currentItem.item);
  }
  let currentLocation = children.identifier[0].location!;
  const suffixes = sortedAccessorSuffixes(children.accessorSuffixes);
  assert(suffixes, 'Expected suffixes');
  if (!suffixes.length) {
    return finalType;
  }

  // Compute useful metadata
  /** If true, then the `new` keyword prefixes this. */
  const usesNew = !!children.New?.length;
  /** If not `undefined`, this is the assignment node */
  const assignment = children.assignment?.[0];
  const assignmentType = assignment?.children.assignmentRightHandSide
    ? this.assignmentRightHandSide(
        assignment.children.assignmentRightHandSide[0].children,
        withCtxKind(ctx, 'assignment'),
      )
    : this.UNKNOWN;
  this.UPDATED_TYPE_WITH_DOCS(assignmentType);

  // For each suffix in turn, try to figure out how it changes the scope,
  // find the corresponding symbol, etc.

  suffixLoop: for (let s = 0; s < suffixes.length; s++) {
    const suffix = suffixes[s];
    const suffixRange = this.PROCESSOR.range(suffix.location!);
    const currentType: Type | null = currentItem?.item
      ? getType(currentItem.item)
      : null;
    const isLastSuffix = s === suffixes.length - 1;
    switch (suffix.name) {
      case 'arrayMutationAccessorSuffix':
      case 'arrayAccessSuffix':
      case 'mapAccessSuffix':
      case 'gridAccessSuffix':
      case 'listAccessSuffix':
      case 'structAccessSuffix':
        const type: Type = currentType?.items ?? this.UNKNOWN;
        const ref = type.addRef(suffixRange);
        currentItem = {
          item: type,
          ref,
        };
        finalType = getType(currentItem.item);
        break;
      case 'dotAccessSuffix':
        // Then we need to change self-scope to be inside
        // the prior struct.
        const dotAccessor = suffix.children;
        const dot = fixITokenLocation(dotAccessor.Dot[0]);
        if (
          isTypeOfKind(currentType, 'Struct') ||
          isTypeOfKind(currentType, 'Enum')
        ) {
          this.PROCESSOR.scope.setEnd(dot);
          this.PROCESSOR.pushSelfScope(dot, currentType, true, {
            accessorScope: true,
          });
          // While editing a user will dot into something
          // prior to actually adding the new identifier.
          // To provide autocomplete options, we need to
          // still add a scopeRange for the dot.
          if (isEmpty(dotAccessor.identifier[0].children)) {
            this.PROCESSOR.scope.setEnd(dot, true);
            this.PROCESSOR.popSelfScope(dot, true);
            currentItem = undefined;
            finalType = this.UNKNOWN;
          } else {
            const nextIdentity = identifierFrom(dotAccessor);
            let nextItem = this.identifier(
              dotAccessor.identifier[0].children,
              ctx,
            );
            const nextItemLocation = dotAccessor.identifier[0].location!;
            const range = this.PROCESSOR.range(nextItemLocation);
            if (!nextItem && isTypeOfKind(currentType, 'Struct')) {
              // Then this variable is not yet defined on this struct.
              // We need to add it!
              ok(nextIdentity, 'Could not get next identity');
              const newMemberType = isLastSuffix
                ? assignmentType
                : this.UNKNOWN;
              // Add this member to the struct
              const newMember: TypeMember = currentType.addMember(
                nextIdentity.name,
                newMemberType,
              );
              newMember.instance = true;
              const ref = newMember.addRef(range);
              // If this is the last suffix and this is
              // an assignment, then also set the `def` of the
              // new member.
              if (isLastSuffix && assignment) {
                newMember.definedAt(range);
              } else {
                // Else emit a warning that this member is
                // not definitely defined.
                this.PROCESSOR.addDiagnostic(
                  nextItemLocation,
                  `Member ${nextIdentity.name} is not definitely defined`,
                );
              }
              nextItem = {
                item: newMember,
                ref,
              };
            } else if (nextItem) {
              // Make sure we still have a definition
              nextItem.item.def ||= range;
              nextItem.item.addRef(range);
              finalType = getType(nextItem.item);
            } else {
              finalType = this.UNKNOWN;
            }
            currentItem = nextItem;
            currentLocation = nextItemLocation;
            this.PROCESSOR.scope.setEnd(currentLocation, true);
            this.PROCESSOR.popSelfScope(currentLocation, true);
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
          ).includes(currentType?.kind!);
          if (!isDotAccessible) {
            this.PROCESSOR.addDiagnostic(
              currentLocation,
              `Type ${currentType?.toFeatherString()} is not a struct`,
            );
          }
          finalType = this.UNKNOWN;
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
            const start = Position.fromCstEnd(
              this.PROCESSOR.file,
              lastDelimiter!,
            );
            // end on the LEFT side of the second delimiter
            const end = Position.fromCstStart(this.PROCESSOR.file, token);
            const funcRange = new FunctionArgRange(
              currentItem!.ref!,
              argIdx,
              start,
              end,
            );
            if (!lastTokenWasDelimiter) {
              funcRange.hasExpression = true;
            }
            this.PROCESSOR.file.addFunctionArgRange(funcRange);
            ranges.push(funcRange);

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
          usesNew && isLastSuffix
            ? currentType?.constructs
            : currentType?.returns;
        currentItem = { item: returnType!, ref: currentItem!.ref };
        // Add the function call to the file for diagnostics
        this.PROCESSOR.file.addFunctionCall(ranges);
        finalType = returnType || this.UNKNOWN;
        break;
      default:
        this.visit(suffix, ctx);
        const defaultType = this.UNKNOWN;
        const defaultRef = defaultType.addRef(suffixRange);
        currentItem = { item: defaultType, ref: defaultRef };
        finalType = this.UNKNOWN;
    }
  }
  return finalType;
}
