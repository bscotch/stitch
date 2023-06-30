import type { FunctionExpressionCstChildren } from '../gml-cst.js';
import { VisitorContext, withCtxKind } from './parser.js';
import { fixITokenLocation } from './project.location.js';
import { Signifier } from './signifiers.js';
import type { FunctionType, StructType, Type } from './types.js';
import { mergeManyTypes } from './types.merge.js';
import { assert, ok } from './util.js';
import type { GmlSymbolVisitor } from './visitor.js';

export function visitFunctionExpression(
  this: GmlSymbolVisitor,
  children: FunctionExpressionCstChildren,
  ctx: VisitorContext,
): Type<'Function'> {
  // Reset the list of return values
  ctx = {
    ...ctx,
    returns: [],
  };

  // Get this identifier if we already have it.
  const identifier = this.FIND_ITEM(children);
  // Consume the most recent jsdoc
  let docs = this.PROCESSOR.consumeJsdoc();
  if (!docs?.type.isFunction && docs?.jsdoc.kind !== 'description') {
    // Then these docs are not applicable, so toss them.
    docs = undefined;
  }

  // Compute useful properties of this function to help figure out
  // how to define its symbol, type, scope, etc.
  let functionName: string | undefined = children.Identifier?.[0]?.image;
  const nameLocation = functionName
    ? this.PROCESSOR.range(children.Identifier![0])
    : undefined;
  const isConstructor = !!children.constructorSuffix;
  const functionTypeName = isConstructor ? 'Constructor' : 'Function';
  const bodyLocation = children.blockStatement[0].location!;

  // Create the symbol if we don't already have it
  const item = (identifier?.item ||
    new Signifier(
      undefined, // TODO: Reorganize all of this so we know the scope already
      functionName || '',
      this.PROCESSOR.project.createType(functionTypeName).setName(functionName),
    )) as Signifier | Signifier;
  functionName = item.name;
  if (nameLocation) {
    item.addRef(nameLocation);
    item.definedAt(nameLocation);
  }

  // Make sure we have a proper type
  if (item.type.kind === 'Unknown') {
    item.type.kind = functionTypeName;
  }
  const functionType = item.type as FunctionType;

  // Use JSDocs to fill in any missing top-level information
  ok(
    functionType.isFunction,
    `Expected function type, got ${functionType.kind}`,
  );
  functionType.describe(functionType.description || docs?.type.description);
  functionType.context =
    docs?.type.context?.kind === 'Struct'
      ? docs.type.context
      : (this.PROCESSOR.currentSelf as StructType);

  // Ensure that constructors have an attached constructed type
  if (isConstructor && !functionType.constructs) {
    functionType.constructs =
      this.PROCESSOR.createStruct(bodyLocation).setName(functionName);
  }

  // Identify the "self" struct for scope. If this is a constructor, "self" is the
  // constructed type. Otherwise, for now just create a new struct type
  // for the self scope.
  const functionSelfScope = (
    isConstructor ? functionType.constructs : functionType.context
  )!;

  // If this is not part of an assignment, then we need to add this
  // function's symbol to the current scope.
  if (nameLocation && ctx.ctxKindStack.at(-1) !== 'assignment' && !identifier) {
    const self = this.PROCESSOR.currentSelf;
    const member =
      self.getMember(functionName) || self.addMember(functionName, item.type);
    member.definedAt(nameLocation);
    member.addRef(nameLocation);
  }

  // Functions have their own localscope as well as their self scope,
  // so we need to push both.
  const startParen = fixITokenLocation(
    children.functionParameters[0].children.StartParen[0],
  );
  this.PROCESSOR.scope.setEnd(startParen);
  this.PROCESSOR.pushScope(startParen, functionSelfScope, true);
  const functionLocalScope = this.PROCESSOR.currentLocalScope;

  // TODO: Handle constructor inheritance. The `constructs` type should
  // be based off of the parent.

  // Add function signature components. We may be *updating*, e.g.
  // if this was a global function and we're recomputing. So update
  // instead of just adding or even clearing-then-adding.
  const params =
    children.functionParameters?.[0]?.children.functionParameter || [];
  for (let i = 0; i < params.length; i++) {
    const paramCtx = withCtxKind(ctx, 'functionParam');
    const param = params[i].children.Identifier[0];
    const range = this.PROCESSOR.range(param);

    // Use JSDocs to determine the type, description, etc of the parameter
    let fromJsdoc = docs?.type.getParam(i);
    if (fromJsdoc && param.image !== fromJsdoc.name) {
      this.PROCESSOR.addDiagnostic(
        'JSDOC_MISMATCH',
        param,
        `Parameter name mismatch`,
      );
      // Unset it so we don't accidentally use it!
      fromJsdoc = undefined;
    }
    const paramType = fromJsdoc?.type || this.UNKNOWN.definedAt(range);
    const optional = fromJsdoc?.optional || !!params[i].children.Assign;
    functionType.setParam(i, param.image, paramType, optional).definedAt(range);
    if (params[i].children.assignmentRightHandSide) {
      this.assignmentRightHandSide(
        params[i].children.assignmentRightHandSide![0].children,
        paramCtx,
      );
    }

    // Also add to the function's local scope.
    const member = functionLocalScope
      .setMember(param.image, paramType)
      .definedAt(range);
    member.addRef(range);
    member.local = true;
    member.parameter = true;
  }
  // If we have more args defined in JSDocs, add them!
  if ((docs?.type?.listParams().length || 0) > params.length) {
    const extraParams = docs!.type.listParams().slice(params.length);
    assert(extraParams, 'Expected extra params');
    for (let i = 0; i < extraParams.length; i++) {
      const idx = params.length + i;
      const param = extraParams[i];
      assert(param, 'Expected extra param');
      const paramType = param.type;
      const optional = param.optional;
      functionType.setParam(idx, param.name, paramType, optional);
      // Do not add to local scope, since if it's only defined
      // in the JSDoc it's not a real parameter.
    }
  }

  // TODO: Remove any excess parameters, e.g. if we're updating a
  // prior definition. This is tricky since we may need to do something
  // about references to legacy params.

  // Process the function body
  this.visit(children.blockStatement, withCtxKind(ctx, 'functionBody'));

  // Update the RETURN type based on the return statements found in the body
  const inferredReturnType = ctx.returns?.length
    ? mergeManyTypes(ctx.returns)
    : this.PROCESSOR.project.createType('Undefined');
  if (docs?.type.returns) {
    functionType.returns = docs.type.returns;
    // TODO: Check against the inferred return types
  } else {
    functionType.returns = inferredReturnType;
  }

  // End the scope
  const endBrace = fixITokenLocation(
    children.blockStatement[0].children.EndBrace[0],
  );
  this.PROCESSOR.scope.setEnd(endBrace);
  this.PROCESSOR.popScope(endBrace, true);
  return functionType;
}
