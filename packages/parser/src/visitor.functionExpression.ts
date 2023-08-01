import type { FunctionExpressionCstChildren } from '../gml-cst.js';
import { VisitorContext, withCtxKind } from './parser.js';
import { Range, fixITokenLocation } from './project.location.js';
import { Signifier } from './signifiers.js';
import { getTypeOfKind } from './types.checks.js';
import { Type, TypeStore, WithableType, type StructType } from './types.js';
import { withableTypes } from './types.primitives.js';
import { assert } from './util.js';
import type { GmlSignifierVisitor } from './visitor.js';

/** Visit a function's CST and update any signifiers and types */
export function visitFunctionExpression(
  this: GmlSignifierVisitor,
  children: FunctionExpressionCstChildren,
  ctx: VisitorContext,
): Type<'Function'> | undefined {
  const docs = ctx.docs || this.PROCESSOR.consumeJsdoc();
  ctx.docs = undefined;
  const assignedTo = ctx.signifier;
  ctx.signifier = undefined;

  if (!children.blockStatement) {
    // Then we're in a recovery situation and should just move along
    return;
  }

  // Reset the list of return values
  ctx = {
    ...ctx,
    returns: [],
  };

  // Compute useful properties of this function to help figure out
  // how to define its symbol, type, scope, etc.
  const functionName: string | undefined = children.Identifier?.[0]?.image;
  const nameLocation = functionName
    ? this.PROCESSOR.range(children.Identifier![0])
    : undefined;
  const isConstructor = !!children.constructorSuffix;
  const bodyLocation = children.blockStatement[0].location!;
  const isFunctionStatement = ctx.ctxKindStack.at(-1) === 'functionStatement';
  const isMixin = !!docs?.jsdoc.mixin;

  /** If this function has a corresponding signifier, either
   * because it is a function declaration or because it is a
   * function expression assigned to a variable, then that's
   * what this is.
   *
   * @remarks Function expressions need not be assigned to anything, necessarily, so they may not have a signifier.
   */
  let signifier: Signifier | undefined;
  if (assignedTo) {
    signifier = assignedTo;
  } else if (isFunctionStatement && functionName) {
    // Then this function is being created by declaration,
    // without being assigned to a variable. Find or create
    // the signifier and update its definedAt & refs.
    const matching = this.FIND_ITEM(children, { excludeParents: true });
    if (matching?.item.$tag === 'Sym') {
      signifier = matching.item;
    } else {
      signifier = new Signifier(this.PROCESSOR.currentSelf, functionName);
      // This function is overriding any parent function of the same name
      signifier.override = true;
      this.PROCESSOR.currentSelf.addMember(signifier);
    }
    if (nameLocation && signifier && !signifier.def) {
      signifier?.definedAt(nameLocation);
      signifier?.addRef(nameLocation!, true);
    }
  }

  // Get or create the function type. Use the existing type if there is one.
  signifier?.describe(docs?.jsdoc.description);
  const functionType =
    signifier?.getTypeByKind('Function') ||
    new Type('Function').named(functionName);
  signifier?.setType(functionType);
  if (signifier && docs?.jsdoc.deprecated) {
    signifier.deprecated = true;
  }
  if (signifier && docs?.jsdoc.mixin) {
    signifier.mixin = true;
  }
  functionType.isConstructor = isConstructor;
  functionType.self = isConstructor
    ? functionType.self || this.PROCESSOR.createStruct(bodyLocation)
    : undefined;
  if (isConstructor) {
    functionType.self?.named(functionName);
  }
  functionType.returns ||= new TypeStore();

  // Determine the function context.
  let docContextRaw =
    docs?.jsdoc.kind === 'self'
      ? docs.type[0]
      : docs?.jsdoc.kind === 'function'
      ? docs.type[0]?.self
      : undefined;
  if (docContextRaw && docContextRaw.kind === 'Function') {
    // Then we use the function's construct if it is a constructor, else its context.
    docContextRaw = docContextRaw.self;
  }

  const docContext = getTypeOfKind(docContextRaw, withableTypes);
  let context: WithableType | undefined;

  if (isConstructor) {
    context = functionType.self!;
  } else if (docContext) {
    context = docContext;
  } else if (ctx.self) {
    // Then we're inside of a method() call, and the self
    // is from the prior argument, and we aren't overriding
    // using jsdoc.
    context = ctx.self as StructType;
  } else if (isMixin) {
    // Then we want to use a new struct type as the context,
    // allowing calls to this function to add those variables to themselves.
    // Try to keep the old context if possible.
    context =
      functionType.self && functionType.self !== this.PROCESSOR.currentSelf
        ? functionType.self
        : this.PROCESSOR.createStruct(bodyLocation);
  }
  ctx.self = undefined; // Just to make sure nothing downstream uses it

  if (docContext?.signifier && context && docs?.jsdoc.self) {
    // Add a reference to the jsdoc
    docContext.signifier.addRef(
      Range.from(this.PROCESSOR.file, docs.jsdoc.self),
    );
  }
  context ||= this.PROCESSOR.currentSelf as StructType;

  functionType.self = context;

  // Ensure local context
  const currentLocalContext = this.PROCESSOR.currentLocalScope;
  functionType.local ||= Type.Struct;
  assert(
    functionType.local !== currentLocalContext,
    'Function local context incorrectly set to prior local context.',
  );

  // Functions have their own localscope as well as their self scope,
  // so we need to push both.
  const startParen = fixITokenLocation(
    children.functionParameters[0].children.StartParen[0],
  );
  this.PROCESSOR.scope.setEnd(startParen);
  this.PROCESSOR.pushScope(
    startParen,
    functionType.self,
    functionType.local,
    true,
  );

  // TODO: Handle constructor inheritance. The `constructs` type should
  // be based off of the parent.

  // Add function signature components. Must take into account that we may
  // be updating after an edit.
  const cstParams =
    children.functionParameters?.[0]?.children.functionParameter || [];
  let totalParams = 0;
  for (let i = 0; i < cstParams.length; i++) {
    const paramCtx = withCtxKind(ctx, 'functionParam');
    const paramToken = cstParams[i].children.Identifier[0];
    const name = paramToken.image;
    const range = this.PROCESSOR.range(paramToken);

    // Use JSDocs to determine the type, description, etc of the parameter
    let fromJsdoc = docs?.type?.[0]?.getParameter(name);
    if (fromJsdoc && paramToken.image !== fromJsdoc.name) {
      this.PROCESSOR.addDiagnostic(
        'JSDOC_MISMATCH',
        paramToken,
        `Parameter name mismatch`,
      );
      // Unset it so we don't accidentally use it!
      fromJsdoc = undefined;
    }
    const paramDoc = fromJsdoc
      ? docs?.jsdoc.params?.find((p) => p.name?.content === name)
      : undefined;

    const paramSignifier =
      functionType.local.getMember(name) || functionType.getParameter(name);
    const param = functionType
      .addParameter(i, paramSignifier || name)
      .definedAt(range);
    param.describe(fromJsdoc?.description);
    param.local = true;
    param.parameter = true;
    param.optional = fromJsdoc?.optional || !!cstParams[i].children.Assign;
    param.addRef(range, true);

    let inferredType: (Type | TypeStore)[] | undefined;
    if (cstParams[i].children.assignmentRightHandSide) {
      inferredType = this.assignmentRightHandSide(
        cstParams[i].children.assignmentRightHandSide![0].children,
        paramCtx,
      );
    }
    const paramType = fromJsdoc?.type.type || inferredType || this.ANY;
    param.setType(paramType);

    // Add a reference to the jsdoc name
    if (paramDoc?.name) {
      param.addRef(Range.from(this.PROCESSOR.file, paramDoc.name));
    }

    // Add a reference to the jsdoc type if it is associated with a signifier
    if (paramDoc?.type && param.type.type[0]?.signifier) {
      // Then we need a reference in the JSDocs
      param.type.type[0].signifier.addRef(
        Range.from(this.PROCESSOR.file, paramDoc.type),
      );
    }

    // Also add to the function's local scope.
    // const localVar = functionType.local.getMember(param.name);
    // if (localVar && localVar !== param) {
    //   debugger;
    // }
    functionType.local.addMember(param);
    totalParams++;
  }
  // If we have more args defined in JSDocs, add them!
  if ((docs?.type[0]?.listParameters().length || 0) > cstParams.length) {
    const extraParams = docs!.type[0].listParameters().slice(cstParams.length);
    assert(extraParams, 'Expected extra params');
    for (let i = 0; i < extraParams.length; i++) {
      const idx = cstParams.length + i;
      const param = extraParams[i];
      assert(param, 'Expected extra param');
      const paramType = param.type;
      const optional = param.optional;
      functionType
        .addParameter(idx, param.name, paramType.type, optional)
        .describe(param.description);
      // Do not add to local scope, since if it's only defined
      // in the JSDoc it's not a real parameter.

      const paramDoc = docs!.jsdoc.params?.find(
        (p) => p.name?.content === param.name,
      );
      if (paramDoc?.type && param.type.type[0]?.signifier) {
        // Then we need a reference in the JSDocs
        param.type.type[0].signifier.addRef(
          Range.from(this.PROCESSOR.file, paramDoc.type!),
        );
      }
      totalParams++;
    }
  }

  // TODO: Remove any excess parameters, e.g. if we're updating a
  // prior definition. This is tricky since we may need to do something
  // about references to legacy params.
  functionType.truncateParameters(totalParams);

  // Process the function body
  this.visit(children.blockStatement, withCtxKind(ctx, 'functionBody'));

  // Update the RETURN type based on the return statements found in the body
  if (docs?.type[0]?.returns) {
    functionType.setReturnType(docs.type[0].returns.type);
    docs.type[0].returns.type[0]?.signifier?.addRef(
      Range.from(this.PROCESSOR.file, docs.jsdoc.returns!.type!),
    );
    // TODO: Check against the inferred return types
  } else {
    functionType.setReturnType(
      ctx.returns?.length ? ctx.returns : this.UNDEFINED,
    );
  }

  // End the scope
  const endBrace = fixITokenLocation(
    children.blockStatement[0].children.EndBrace[0],
  );
  this.PROCESSOR.scope.setEnd(endBrace);
  this.PROCESSOR.popScope(endBrace, true);
  assert(
    functionType.local !== this.PROCESSOR.currentLocalScope,
    'Local scope not popped correctly',
  );
  return functionType;
}
