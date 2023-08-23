// CST Visitor for creating an AST etc
import { Docs, VisitorContext, withCtxKind } from './parser.js';
import {
  Rhs,
  arrayLiteralFromRhs,
  functionFromRhs,
  rhsFrom,
  structLiteralFromRhs,
} from './parser.utility.js';
import { Range, Reference } from './project.location.js';
import { Signifier } from './signifiers.js';
import { normalizeType } from './types.checks.js';
import { WithableType } from './types.js';
import type { GmlSignifierVisitor } from './visitor.js';

export interface AssignmentInfo {
  static?: boolean;
  instance?: boolean;
  local?: boolean;
  docs?: Docs;
  ctx: VisitorContext;
}

export interface AssignmentVariable {
  name: string;
  range: Range;
  container: WithableType;
}

export function assignVariable(
  visitor: GmlSignifierVisitor,
  variable: AssignmentVariable,
  rawRhs: Rhs,
  info: AssignmentInfo,
) {
  const rhs = rhsFrom(rawRhs);

  //#region Collect useful info
  // Figure out what we're assigning to so we can handle
  // already-known types (from JSDocs).
  const fullScope = visitor.PROCESSOR.fullScope;
  // Are we in the definitiveSelf?
  const inDefinitiveSelf = variable.container === fullScope.definitiveSelf;
  //#endregion

  // Find the existing variable
  let signifier = variable.container.getMember(variable.name);
  const isSelfOwned =
    !!signifier && !!variable.container.getMember(variable.name, true);
  let ref: Reference | undefined;

  // Add the variable if missing
  let wasUndeclared = false;
  if (!signifier) {
    wasUndeclared = true;

    if (variable.container !== fullScope.global) {
      // Then we can add a new member
      signifier = variable.container.addMember(variable.name);
      if (signifier) {
        signifier.definedAt(variable.range);
        signifier.static = !!info.static;
        signifier.instance = !!info.instance || !info.local;
        signifier.local = !!info.local;
        signifier.definitive = inDefinitiveSelf;
        ref = signifier.addRef(variable.range, true);
      } else {
        // Then this is an immutable type
        visitor.PROCESSOR.addDiagnostic(
          'INVALID_OPERATION',
          variable.range,
          `Cannot add variables to this type.`,
        );
      }
    } else {
      visitor.PROCESSOR.addDiagnostic(
        'UNDECLARED_GLOBAL_REFERENCE',
        variable.range,
        `${variable.name} is not declared anywhere but is assigned in global scope.`,
      );
    }
  } else {
    // Add a reference to the item.
    ref = signifier.addRef(variable.range);
    // If this is the first time we've seen it, and it wouldn't have
    // an unambiguous declaration, add its definition
    if (!signifier.def) {
      wasUndeclared = true;
      signifier.definedAt(variable.range);
      ref.isDef = true;
    }
    // If this variable comes from a non-definitive declaration,
    // and *would* be definitive here, then we need to update it.
    ensureDefinitive(
      variable.container as WithableType,
      visitor.PROCESSOR.currentDefinitiveSelf,
      signifier,
      ref,
    );
  }

  // Handle RHS
  const assignedToFunction = functionFromRhs(rhs);
  const assignedToStructLiteral = structLiteralFromRhs(rhs);
  const assignedToArrayLiteral = arrayLiteralFromRhs(rhs);
  const ctx = { ...info.ctx };
  if (assignedToFunction || assignedToStructLiteral || assignedToArrayLiteral) {
    ctx.signifier = signifier;
    ctx.docs = info.docs;
    if (assignedToFunction) {
      ctx.self = variable.container;
      visitor.functionExpression(assignedToFunction, ctx);
    } else if (assignedToStructLiteral) {
      visitor.structLiteral(assignedToStructLiteral, ctx);
    } else if (assignedToArrayLiteral) {
      visitor.arrayLiteral(assignedToArrayLiteral, ctx);
    }
  } else if (rhs) {
    const inferredType = normalizeType(
      visitor.assignmentRightHandSide(rhs, withCtxKind(ctx, 'assignment')),
      visitor.PROCESSOR.project.types,
    );
    const forceOverride = info.docs?.jsdoc.kind === 'type';
    if (signifier && (!signifier.isTyped || wasUndeclared || forceOverride)) {
      if (info.docs) {
        signifier.describe(info.docs.jsdoc.description);
        signifier.setType(info.docs.type);
        // if (
        //   info.docs.jsdoc.kind === 'type' &&
        //   info.docs.jsdoc.type &&
        //   info.docs.type[0].signifier
        // ) {
        //   info.docs.type[0].signifier.addRef(
        //     Range.from(visitor.PROCESSOR.file, info.docs.jsdoc.type),
        //   );
        // }
      } else if (inferredType) {
        signifier.setType(inferredType);
      }
    }
  }
  if (signifier && ref) {
    return {
      item: signifier,
      ref: ref,
    };
  }
  return;
}

export function ensureDefinitive(
  self: WithableType,
  currentDefinitiveSelf: WithableType | undefined,
  member: Signifier,
  ref: Reference,
) {
  if (!currentDefinitiveSelf) return;
  // If this variable comes from a non-definitive declaration,
  // and *would* be definitive here, then we need to update it.
  const inDefinitiveSelf = currentDefinitiveSelf === self;
  const isSelfOwned = self.getMember(member.name, true) === member;
  if (isSelfOwned && !member.definitive && inDefinitiveSelf) {
    member.definitive = true;
    // Ensure the definition is HERE
    member.unsetDef();
    member.definedAt(ref);
    for (const otherRef of member.refs) {
      otherRef.isDef = false; // Unset all other definitions
    }
    ref.isDef = true;
  }
}
