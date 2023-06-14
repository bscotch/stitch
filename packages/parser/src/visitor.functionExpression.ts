import type { FunctionExpressionCstChildren } from '../gml-cst.js';
import { fixITokenLocation } from './project.location.js';
import { Symbol } from './project.symbol.js';
import type { FunctionType, StructType, Type, TypeMember } from './types.js';
import { assert, ok } from './util.js';
import type { GmlSymbolVisitor } from './visitor.js';

export function visitFunctionExpression(
  this: GmlSymbolVisitor,
  children: FunctionExpressionCstChildren,
): Type<'Function'> {
  // Get this identifier if we already have it.
  const identifier = this.identifier(children);
  // Consume the most recent jsdoc
  let docs = this.PROCESSOR.useJsdoc();
  if (!docs?.type.isFunction && docs?.type.kind !== 'Unknown') {
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

  // If this is global we should already have a symbol for it.
  // If not, we should create a new symbol.
  const item = (identifier?.item ||
    new Symbol(
      functionName || '',
      this.PROCESSOR.project.createType(functionTypeName).named(functionName),
    )) as Symbol | TypeMember;
  functionName = item.name;

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
  if (docs?.type.deprecated) {
    functionType.deprecated = docs.type.deprecated;
  }

  // Ensure that constructors have an attached constructed type
  if (isConstructor && !functionType.constructs) {
    functionType.constructs =
      this.PROCESSOR.createStruct(bodyLocation).named(functionName);
  }

  // Identify the "self" struct. If this is a constructor, "self" is the
  // constructed type. Otherwise, for now just create a new struct type
  // for the self scope.
  const self = (
    isConstructor ? functionType.constructs : functionType.context
  )!;

  // Make sure this function is a member of the self struct
  let asSelfMember = self.getMember(functionName);
  if (!asSelfMember) {
    asSelfMember = self.addMember(functionName, item.type);
  }
  if (nameLocation) {
    asSelfMember.definedAt(nameLocation);
    asSelfMember.addRef(nameLocation);
  }

  // Functions have their own localscope as well as their self scope,
  // so we need to push both.
  const startParen = fixITokenLocation(
    children.functionParameters[0].children.StartParen[0],
  );
  this.PROCESSOR.scope.setEnd(startParen);
  this.PROCESSOR.pushScope(startParen, self, true);
  const functionLocalScope = this.PROCESSOR.currentLocalScope;

  // TODO: Handle constructor inheritance. The `constructs` type should
  // be based off of the parent.

  // Add function signature components. We may be *updating*, e.g.
  // if this was a global function and we're recomputing. So update
  // instead of just adding or even clearing-then-adding.
  const params =
    children.functionParameters?.[0]?.children.functionParameter || [];
  for (let i = 0; i < params.length; i++) {
    const param = params[i].children.Identifier[0];
    const range = this.PROCESSOR.range(param);

    // Use JSDocs to determine the type, description, etc of the parameter
    let fromJsdoc = docs?.type.getParameter(i);
    if (fromJsdoc && param.image !== fromJsdoc.name) {
      this.PROCESSOR.addDiagnostic(param, `Parameter name mismatch`);
      // Unset it so we don't accidentally use it!
      fromJsdoc = undefined;
    }
    const paramType = fromJsdoc?.type || this.UNKNOWN.definedAt(range);
    const optional = fromJsdoc?.optional || !!params[i].children.Assign;
    functionType
      .addParameter(i, param.image, paramType, optional)
      .definedAt(range);

    // Also add to the function's local scope.
    const member = functionLocalScope
      .addMember(param.image, paramType)
      .definedAt(range);
    member.addRef(range);
    member.local = true;
    member.parameter = true;
  }
  // If we have more args defined in JSDocs, add them!
  if ((docs?.type?.listParameters().length || 0) > params.length) {
    const extraParams = docs!.type.listParameters().slice(params.length);
    assert(extraParams, 'Expected extra params');
    for (let i = 0; i < extraParams.length; i++) {
      const idx = params.length + i;
      const param = extraParams[i];
      assert(param, 'Expected extra param');
      const paramType = param.type;
      const optional = param.optional;
      functionType.addParameter(idx, param.name, paramType, optional);
      // Do not add to local scope, since if it's only defined
      // in the JSDoc it's not a real parameter.
    }
  }

  // TODO: Remove any excess parameters, e.g. if we're updating a
  // prior definition. This is tricky since we may need to do something
  // about references to legacy params.

  // TODO: Add this function to the scope in which it was defined.
  // This is tricky because we need to know if it is being assigned to something, e.g. a var, static, etc, so that we can add it to the correct scope with the correct name.

  // Process the function body
  this.visit(children.blockStatement);

  // End the scope
  const endBrace = fixITokenLocation(
    children.blockStatement[0].children.EndBrace[0],
  );
  this.PROCESSOR.scope.setEnd(endBrace);
  this.PROCESSOR.popScope(endBrace, true);
  return functionType;
}
