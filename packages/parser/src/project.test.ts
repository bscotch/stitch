import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { logger } from './logger.ts';
import type { Asset } from './project.asset.ts';
import { Project } from './project.ts';
import { Native } from './project.native.ts';
import { Signifier } from './signifiers.ts';
import { resetSandbox } from './test.lib.ts';
import { Type, type TypeStore } from './types.ts';
import type { PrimitiveName } from './types.primitives.ts';
import { ok } from './util.ts';

/** Expected member names that are missing from an asset's instance type */
function missingMembers(
  asset: { instanceType?: { listMembers(): { name: string }[] } },
  expected: string[],
): string[] {
  const actual = new Set(asset.instanceType?.listMembers().map((m) => m.name));
  return expected.filter((name) => !actual.has(name));
}

describe('Project', function () {
  it('can load the GML spec', async function () {
    const spec = await Native.from(undefined, new Type('Struct'), new Map());
    assert.ok(spec != null);

    // STRUCTS AND CONSTS
    const track = spec.types.get('Struct.Track');
    ok(track);
    ok(track.kind === 'Struct');

    const name = track.getMember('name');
    ok(name);
    assert.equal(name.type.kind, 'String');

    const visible = track.getMember('visible');
    ok(visible);
    assert.equal(visible.type.kind, 'Bool');

    const tracks = track.getMember('tracks');
    ok(tracks);
    assert.equal(tracks.type.kind, 'Array');
    assert.equal(tracks.type.items[0].kind, 'Struct');
    assert.deepEqual(tracks.type.items[0].type[0], track);

    const keyframes = track.getMember('keyframes');
    ok(keyframes);
    assert.equal(keyframes.type.kind, 'Array');
    assert.equal(keyframes.type.items[0].kind, 'Struct');
    assert.deepEqual(
      keyframes.type.items[0].type[0],
      spec.types.get('Struct.Keyframe'),
    );

    const typeField = track.getMember('type');
    ok(typeField);
    const expectedTypeType = spec.types.get('Constant.SequenceTrackType');
    ok(expectedTypeType);
    ok(typeField.type.type[0] === expectedTypeType);
    ok(expectedTypeType.kind === 'Real');

    // VARIABLES
    const depthSymbol = spec.globalSelf.getMember('depth');
    ok(depthSymbol);
    assert.equal(depthSymbol.type.kind, 'Real');

    // FUNCTIONS
    const scriptExecuteType = spec.types.get('Function.script_execute');
    const scriptExecuteSymbol = spec.globalSelf.getMember('script_execute');
    ok(scriptExecuteSymbol);
    ok(scriptExecuteSymbol.type.type[0] === scriptExecuteType);
    ok(scriptExecuteType);
    ok(scriptExecuteType.kind === 'Function');
    assert.equal(scriptExecuteType.listParameters().length, 2);
    assert.equal(scriptExecuteType.listParameters()![0]!.name, 'scr');
    assert.equal(scriptExecuteType.listParameters()![0]!.type.type.length, 2);
    assert.equal(
      scriptExecuteType.listParameters()![0]!.type.type[0].kind,
      'Function',
    );
    assert.equal(
      scriptExecuteType.listParameters()![0]!.type.type[1].kind,
      'Asset.GMScript',
    );
    assert.equal(scriptExecuteType.listParameters()![1]!.name, '...');
  });

  it('can use fallback GmlSpec', async function () {
    await Project.fallbackGmlSpecPath.exists({ assert: true });
  });

  it('can analyze a representative project', async function () {
    const projectDir = 'samples/project';
    const project = await Project.initialize(projectDir);
    ok(project);

    //#region ASSETS
    const script = project.getAssetByName('Script1')!;
    const scriptFile = script.gmlFile;
    const jsdocs = project.getAssetByName('Jsdocs')!;
    const jsdocsFile = jsdocs.gmlFile;
    const complexScript = project.getAssetByName('Complicated')!;
    const complexScriptFile = complexScript.gmlFile;
    const recoveryScript = project.getAssetByName('Recovery')!;
    const recoveryScriptFile = recoveryScript.gmlFile;
    const obj = project.getAssetByName('o_object')!;
    const objCreate = obj.gmlFilesArray.find((f) => f.name === 'Create_0');
    const objStep = obj.gmlFilesArray.find((f) => f.name === 'Step_0');
    const parent = project.getAssetByName('o_parent')!;
    const child = project.getAssetByName('o_child1')!;
    const grandchild = project.getAssetByName('o_child1_child')!;
    const child2 = project.getAssetByName('o_child2')!;
    ok(script);
    ok(scriptFile);
    ok(jsdocs);
    ok(jsdocsFile);
    ok(complexScript);
    ok(complexScriptFile);
    ok(obj);
    ok(objCreate);
    ok(objStep);
    ok(recoveryScript);
    ok(recoveryScriptFile);
    ok(parent);
    ok(child);
    ok(grandchild);
    ok(child2);
    //#endregion ASSETS

    //#region OBJECT INHERITANCE
    // Child1 and Child2 both inherit from Parent
    // Child1Child inherits from Child1
    // Child2 does not call event_inherited in its Create event
    const parentVars = ['parent_var'];
    const childVars = ['child1_var'];
    const grandchildVars = ['child1_child_var'];
    const child2Vars = ['child2_var'];
    // Check inheritance links
    ok(child.parent === parent);
    ok(grandchild.parent === child);
    ok(child2.parent === parent);
    // Check that variables are propery inherited
    assert.deepEqual(missingMembers(parent, parentVars), []);
    assert.deepEqual(missingMembers(child, [...parentVars, ...childVars]), []);
    assert.deepEqual(
      missingMembers(grandchild, [
        ...parentVars,
        ...childVars,
        ...grandchildVars,
      ]),
      [],
    );
    assert.deepEqual(missingMembers(child2, child2Vars), []);
    assert.notDeepEqual(missingMembers(child2, parentVars), []);

    // Check that a reference to the parent_var works in the grandchild
    const grandChildRef = grandchild.gmlFile.getReferenceAt(4, 24);
    ok(grandChildRef);
    assert.equal(grandChildRef.item.name, 'parent_var');
    ok(grandChildRef.item === parent.instanceType!.getMember('parent_var'));
    ok(grandChildRef.item.def);

    //#endregion OBJECT INHERITANCE

    // Check fancy assignmnent operators
    const decrementer = script.gmlFile.getReferenceAt(72, 3);
    ok(decrementer);
    const decrementRhs = script.gmlFile.getReferenceAt(72, 19);
    ok(decrementRhs);

    // Check assignment to an unknown variable
    const unknownVar = script.gmlFile.getReferenceAt(76, 13);
    ok(!unknownVar);
    const unknownVarRhs = script.gmlFile.getReferenceAt(76, 24);
    ok(unknownVarRhs);

    // Check reference inside of an accessor
    const accessorRef = script.gmlFile.getReferenceAt(81, 27);
    ok(accessorRef);

    //#region GLOBALVARS
    const globalVarName = 'GLOBAL_SCRIPT_VAR';
    const globalvarDef = scriptFile.getReferenceAt(2, 18);
    const globalvarRef = scriptFile.getReferenceAt(2, 37);
    const otherGlobalvarRef = objStep.getReferenceAt(2, 36);
    ok(globalvarDef);
    ok(globalvarRef);
    ok(otherGlobalvarRef);
    // All refs should point to the same thing
    ok(globalvarDef.item === globalvarRef.item);
    ok(globalvarDef.item === otherGlobalvarRef.item);
    // The definition should exist and be named
    const item = globalvarDef.item;
    ok(item.isRenameable);
    ok(item.def);
    ok(item.name === globalVarName);
    // The globalvar should have appropriate symbol and type info
    ok(item.$tag === 'Sym');
    ok(item.global === true);
    //#endregion GLOBALVARS

    //#region REF RENAMING
    assert.equal(globalvarRef.text, globalVarName);
    assert.equal(globalvarRef.isRenameable, true);
    //#endregion REF RENAMING

    //#region ROOT SCRIPT SCOPE
    const inRootScriptScope = scriptFile.getInScopeSymbolsAt(762);
    ok(inRootScriptScope.length);
    // Local scope
    const localConstructed = inRootScriptScope.find(
      (id) => id.name === 'const',
    );
    ok(localConstructed);
    ok(localConstructed.local);
    ok(!localConstructed.global);
    // Global scope
    const globalConstructor = inRootScriptScope.find(
      (id) => id.name === 'GlobalConstructor',
    ) as Signifier;
    ok(globalConstructor);
    ok(!globalConstructor.local);
    ok(globalConstructor.global);
    ok(globalConstructor.name === 'GlobalConstructor');
    ok(globalConstructor.type.constructs);
    ok(globalConstructor.type.constructs[0].name === 'GlobalConstructor');
    ok(globalConstructor.type.type[0].isFunction);
    assert.equal(globalConstructor.type.kind, 'Function');
    assert.equal(globalConstructor.type.type[0].isConstructor, true);
    // Instance scope (should not be found)
    ok(!inRootScriptScope.find((id) => id.name === 'instance_function'));
    // Deeper local scope (should not be found)
    ok(!inRootScriptScope.find((id) => id.name === '_name'));
    //#endregion ROOT SCRIPT SCOPE

    //#region FUNCTION SCOPE
    // Params
    const paramName = '_name';
    const paramRef = scriptFile.getReferenceAt({ line: 18, column: 32 });
    ok(paramRef);
    assert.equal(paramRef.text, paramName);
    const param = paramRef.item as Signifier;
    ok(param);
    ok(param.local);
    ok(param.parameter);
    assert.equal(param.name, paramName);
    // Params should be visible in the function scope
    const inFunctionScope = scriptFile.getInScopeSymbolsAt(19, 16);
    ok(inFunctionScope.length);
    ok(inFunctionScope.find((id) => id.name === paramName));
    // And so should local vars
    const inFunctionLocalvar = inFunctionScope.find(
      (id) => id.name === 'local',
    );
    ok(inFunctionLocalvar);
    ok(scriptFile.getReferenceAt(21, 10)!.item === inFunctionLocalvar);
    //#endregion FUNCTION SCOPE

    //#region INSTANCE SCOPE
    const instanceVarName = 'instance_variable';
    const inInstanceScope = objStep.getReferenceAt(4, 9);
    const objectType = obj.instanceType;
    ok(objectType);
    ok(inInstanceScope);
    assert.equal(inInstanceScope.text, instanceVarName);
    ok(inInstanceScope.item.name === instanceVarName);
    ok(inInstanceScope.item.instance);
    // Are functions properly added to self?
    const instanceFunctionName = 'instance_function';
    const instanceFunction = objectType.getMember(instanceFunctionName);
    ok(instanceFunction);
    //#endregion INSTANCE SCOPE

    //#region ENUMS
    const enumName = 'SurpriseEnum';
    const enumMemberName = 'another_surprise';
    const enumDef = scriptFile.getReferenceAt(22, 12);
    const enumMemberDef = scriptFile.getReferenceAt(22, 40);
    ok(enumDef);
    assert.equal(enumDef.text, enumName);
    ok(enumDef.item.name === enumName);
    ok(enumMemberDef);
    ok(enumMemberDef.item.name === enumMemberName);

    const enumRef = objCreate.getReferenceAt(3, 23);
    const enumMemberRef = objCreate.getReferenceAt(3, 38);
    ok(enumRef);
    ok(enumRef.item.name === enumName);
    ok(enumMemberRef);
    assert.equal(enumMemberRef.text, enumMemberName);
    ok(enumMemberRef.item.name === enumMemberName);
    //#endregion ENUMS

    //#region RECOVERY
    const enumAutocompleteScope = recoveryScriptFile.getScopeRangeAt(3, 22);
    ok(enumAutocompleteScope);
    const enumAutocompleteList = recoveryScriptFile.getInScopeSymbolsAt(3, 22);
    ok(enumAutocompleteList);
    assert.equal(enumAutocompleteList.length, 2);
    //#endregion RECOVERY

    //#region CONSTRUCTORS
    const constructorName = 'GlobalConstructor';
    const constructorDef = scriptFile.getReferenceAt(18, 17);
    const constructorSymbol = constructorDef!.item;
    const constructorType = constructorSymbol.type as TypeStore<'Function'>;
    ok(constructorDef);
    assert.equal(constructorDef.text, constructorName);
    ok(constructorSymbol);
    ok(constructorType);
    ok(constructorSymbol.name === constructorName);
    ok(constructorSymbol instanceof Signifier);
    assert.equal(constructorSymbol.type.kind, 'Function');
    assert.equal(constructorSymbol.type.type[0].isConstructor, true);
    assert.equal(constructorType.type[0].name, constructorName);
    assert.equal(constructorType.type[0].listParameters().length, 2);
    assert.equal(constructorType.constructs[0].kind, 'Struct');
    assert.equal(constructorType.constructs[0].name, constructorName);
    ok(project.self.getMember(constructorName) === constructorSymbol);
    ok(
      project.types.get(`Struct.${constructorName}`) ===
        constructorType.constructs[0],
    );

    //#endregion CONSTRUCTORS

    //#region FUNCTION CALLS
    ok(!scriptFile.getFunctionArgRangeAt(29, 35)!.hasExpression);
    ok(scriptFile.getFunctionArgRangeAt(41, 50)!.hasExpression);
    //#endregion FUNCTION CALLS

    //#region DOT ASSIGNMENTS
    const dotAssignedRefName = 'another_instance_variable';
    const dotAssignedRef = objCreate.getReferenceAt(20, 14);
    const dotAssignedType = dotAssignedRef?.item as Signifier;
    ok(dotAssignedRef);
    assert.equal(dotAssignedRef.text, dotAssignedRefName);
    ok(dotAssignedRef.item.name === dotAssignedRefName);
    ok(dotAssignedType);
    ok(dotAssignedType.parent === obj.instanceType?.extends);
    //#endregion DOT ASSIGNMENTS

    //#region FUNCTIONS
    // Check the return type of a function
    const functionDefRef = complexScriptFile.getReferenceAt(119, 22);
    assert.equal(
      (functionDefRef?.item as Signifier).type.returns[0].kind,
      'Array',
    );
    const globalFunction = scriptFile.getReferenceAt(6, 19);
    ok(globalFunction);
    ok(globalFunction.item.name === 'global_function');
    //#endregion FUNCTIONS

    await validateCrossFileDiagnostics(project);
    validateGenerics(project);
    validateWithContexts(project);
    validateFunctionContexts(project);
    validateJsdocs(project);

    validateBschemaConstructor(project);
    await validateAccessorTypes(project);

    // Reprocess a file and ensure that the tests still pass
    await complexScriptFile.reload();
    logger.log('Re-running after reload...');
    validateBschemaConstructor(project);
  });

  it(
    'removes stale members when a file is reloaded mid-edit',
    {
      todo: 'Known bug: the old `a` member remains on the reloaded constructor type',
    },
    async function () {
      const project = await Project.initialize('samples/project');
      const complexScriptFile = project.getAssetByName('Complicated')!.gmlFile;
      // Mock reload a file during editing and ensure that
      // no extraneous identifiers are created
      let code = complexScriptFile.content;
      await complexScriptFile.reload(
        code + `\n\nfunction Tmp () constructor {a}`,
        { reloadDirty: true },
      );
      await complexScriptFile.reload(
        code + `\n\nfunction Tmp () constructor {ab}`,
        { reloadDirty: true },
      );
      // A should no longer exist!
      assert(complexScriptFile.refs.find((r) => r.item.name === 'ab'));
      assert(!complexScriptFile.refs.find((r) => r.item.name === 'a'));
      assert(
        complexScriptFile.refs
          .find((r) => r.item.name === 'Tmp')!
          .item.type.type[0].self!.getMember('ab'),
      );
      assert(
        !complexScriptFile.refs
          .find((r) => r.item.name === 'Tmp')!
          .item.type.type[0].self!.getMember('a'),
      );
    },
  );

  it('can sync datafiles', async function () {
    const project = await resetSandbox();
    await project.dir
      .join('datafiles/test-folder/test-file.txt')
      .write('hello');
    await project.syncIncludedFiles();
    assert(
      project.datafiles.find(
        (f) =>
          f.name === 'test-file.txt' && f.filePath === 'datafiles/test-folder',
      ),
    );
  });

  it.skip('can parse sample project', async function () {
    const projectDir = process.env.GML_PARSER_SAMPLE_PROJECT_DIR;
    ok(
      projectDir,
      'A dotenv file should provide a path to a full sample project, as env var GML_PARSER_SAMPLE_PROJECT_DIR',
    );
    const project = await Project.initialize(projectDir);
  });
});

function validateGenerics(project: Project) {
  const scriptFile = project.getAssetByName('Generics')!.gmlFile;
  const o_object = project.getAssetByName('o_object')! as Asset<'objects'>;

  // SIMPLE IDENTIFY FUNCTION
  const identifyFunc = scriptFile.getReferenceAt(4, 15)!.item;
  const returns = identifyFunc.type.returns;
  assert.equal(returns.length, 1);
  assert.equal(returns[0].type[0].name, 'T');

  const sampleType = scriptFile.getReferenceAt(8, 9)!.item.type.type[0];
  const returnedSample = scriptFile.getReferenceAt(11, 11)!.item;
  const returnedSampleType = returnedSample.type.type[0];
  ok(sampleType.kind === returnedSampleType.kind);

  // InstanceType<>
  const returnedInstance = scriptFile.getReferenceAt(24, 7)!.item.type.type[0];
  ok(returnedInstance.kind === o_object.instanceType!.kind);

  // ObjectType<>
  const returnedObject = scriptFile.getReferenceAt(25, 7)!.item.type.type[0];
  ok(returnedObject.kind === o_object.assetType.kind);
}

async function validateCrossFileDiagnostics(project: Project) {
  // In VSCode, we were finding that when a Create event was updated
  // then a struct stored in its variables would have incorrect "missing"
  // properties in the Step of the same object.
  const asset = project.getAssetByName('o_child1_child')!;
  const createEvent = asset.getEventByName('Create_0')!;
  const stepEvent = asset.getEventByName('Step_0')!;
  const propName = 'idle';

  const declaration = createEvent.getReferenceAt(5, 4)!;
  const reference = stepEvent.getReferenceAt(1, 20)!;

  const propertyDeclaration = createEvent.getReferenceAt(6, 5)!;
  const propertyReference = stepEvent.getReferenceAt(1, 25)!;

  assert(declaration.item === reference.item);
  assert(propertyDeclaration.item === propertyReference.item);
  assert(propertyDeclaration.item.name === propName);
  assert(
    declaration.item.type.type[0]!.getMember(propName) ===
      propertyDeclaration.item,
  );
  // Should not have any diagnostics in these files.
  const stepDiagnostics =
    stepEvent.getDiagnostics().UNDECLARED_VARIABLE_REFERENCE;
  assert.equal(stepDiagnostics.length, 0);

  // Upon reloading the Create event, should STILL have
  // no diagnostics and the references
  // should all go to the same, *defined* signifiers.
  await createEvent.reload(createEvent.content, { reloadDirty: true });

  const reloadedDeclaration = createEvent.getReferenceAt(5, 4)!;
  assert(reloadedDeclaration.item === declaration.item);
  const reloadedReference = stepEvent.getReferenceAt(1, 20)!;
  assert.equal(reloadedReference.item, reloadedDeclaration.item);

  const reloadedPropertyDeclaration = createEvent.getReferenceAt(6, 5)!;
  assert(reloadedPropertyDeclaration.item.name === propName);
  assert(reloadedPropertyDeclaration.item === propertyDeclaration.item);
  const reloadedPropertyReference = stepEvent.getReferenceAt(1, 25)!;
  assert(reloadedPropertyReference.item === reloadedPropertyDeclaration.item);

  const reloadedStepDiagnostics =
    stepEvent.getDiagnostics().UNDECLARED_VARIABLE_REFERENCE;
  assert.equal(reloadedStepDiagnostics.length, 0);
}

async function validateAccessorTypes(project: Project) {
  // There was an issue where the type retrieved from an accessor
  // would end up being a *new* type, causing structs to lose
  // properties upon reload

  // The sample case is in the `Reactions` script, where the
  // `_timer` localvar initially has the expected struct type
  // but after reloading it is missing most of its properties

  const reactionTimerFunction = project.self.getMember('ReactionTimer');
  ok(reactionTimerFunction);
  const reactionTimerConstruct = reactionTimerFunction.type.constructs[0];
  ok(reactionTimerConstruct);
  ok(reactionTimerConstruct.name === 'ReactionTimer');
  const expectedMemberNames = [
    'reaction_id',
    'timer',
    'maxtime_min',
    'maxtime_max',
    'maxtime',
    'event_id',
  ];
  const assertAllMembersExist = (type: TypeStore) => {
    expectedMemberNames.forEach((name) => {
      ok(type.type[0].getMember(name), `Missing member ${name}`);
    });
  };

  const reactionsAsset = project.getAssetByName('Reactions')!;
  const reactionsFile = reactionsAsset.gmlFile;
  const functionScope = reactionsFile.getScopeRangeAt(3, 1);
  ok(functionScope);
  const timerVar = functionScope!.local.getMember('_timer');
  ok(timerVar);
  ok(
    timerVar.type.type[0] === reactionTimerConstruct,
    'Timer var type is not the expected type',
  );
  let withContext = reactionsFile.getScopeRangeAt(5, 1)!;
  ok(withContext.self === reactionTimerConstruct);
  assertAllMembersExist(timerVar.type);

  // Reload the file and ensure that the type is still correct
  await reactionsFile.reload();
  const reloadedTimerVar = reactionsFile
    .getScopeRangeAt(3, 1)!
    .local.getMember('_timer');
  ok(reloadedTimerVar);
  ok(
    reloadedTimerVar.type.type[0] === reactionTimerConstruct,
    'Timer var type is not the expected type after reload',
  );
  withContext = reactionsFile.getScopeRangeAt(5, 1)!;
  ok(withContext.self === reactionTimerConstruct);
  assertAllMembersExist(reloadedTimerVar.type);
}

function validateFunctionContexts(project: Project) {
  const complicatedScriptFile = project.getAssetByName('Complicated')!.gmlFile;
  const functionScript = project.getAssetByName('FunctionSelf')!;
  const functionScriptFile = functionScript.gmlFile;
  ok(functionScript);
  ok(functionScriptFile);
  ok(complicatedScriptFile);

  // GLOBAL CONSTRUCTED CONTEXT
  const bschemaGlobalContext = complicatedScriptFile.getReferenceAt(
    7,
    14,
  )!.item;
  const functionWithBschemaGlobalContext = functionScriptFile.getScopeRangeAt(
    2,
    32,
  )!;
  ok(
    functionWithBschemaGlobalContext &&
      functionWithBschemaGlobalContext.self ===
        bschemaGlobalContext.type.constructs[0],
  );

  // OBJECT CONTEXT
  const obj = project.getAssetByName('o_object')!;
  ok(obj && obj.instanceType);
  const functionWithObjectContext = functionScriptFile.getScopeRangeAt(7, 25)!;
  ok(
    functionWithObjectContext &&
      functionWithObjectContext.self === obj.assetType,
  );

  // INSTANCE CONTEXT
  const functionWithInstanceContext = functionScriptFile.getScopeRangeAt(
    12,
    27,
  );
  ok(
    functionWithInstanceContext &&
      functionWithInstanceContext.self === obj.instanceType,
  );
}

function validateJsdocs(project: Project) {
  const jsdocsFile = project.getAssetByName('Jsdocs')!.gmlFile;
  const jsdocs = jsdocsFile.jsdocs;
  assert.equal(jsdocs.length, 8);

  // Check positions
  let jsdoc = jsdocs[0];
  assert.equal(jsdoc.start.line, 1);
  assert.equal(jsdoc.start.column, 1);
  assert.equal(jsdoc.end.line, 11);
  assert.equal(jsdoc.end.column, 16);
  assert.equal(jsdoc.params![2].optional, true);
  assert.equal(jsdoc.params![2].name!.content, 'maybe');
  assert.equal(jsdoc.params![2].name!.start.line, 6);
  assert.equal(jsdoc.params![2].name!.end.line, 6);
  assert.equal(jsdoc.params![2].name!.start.column, 22);
  assert.equal(jsdoc.params![2].name!.end.column, 26);
  assert.equal(jsdoc.params![2].type!.content, 'Struct');
  assert.equal(jsdoc.params![2].type!.start.line, 6);
  assert.equal(jsdoc.params![2].type!.end.line, 6);
  assert.equal(jsdoc.params![2].type!.start.column, 13);
  assert.equal(jsdoc.params![2].type!.end.column, 18);

  jsdoc = jsdocs[1];
  assert.equal(jsdoc.start.line, 13);
  assert.equal(jsdoc.start.column, 3);
  assert.equal(jsdoc.end.line, 14);
  assert.equal(jsdoc.end.column, 21);

  jsdoc = jsdocs[2];
  assert.equal(jsdoc.start.line, 17);
  assert.equal(jsdoc.start.column, 3);
  assert.equal(jsdoc.end.line, 19);
  assert.equal(jsdoc.end.column, 6);

  jsdoc = jsdocs[3];
  assert.equal(jsdoc.start.line, 23);
  assert.equal(jsdoc.start.column, 1);
  assert.equal(jsdoc.end.line, 34);
  assert.equal(jsdoc.end.column, 38);

  // This one was misbehaving despite the above tests passing
  const scriptFile = project.getAssetByName('Script1')!.gmlFile;
  const lastJsdoc = scriptFile.jsdocs.at(-3)!;
  assert.equal(lastJsdoc.start.line, 55);
  assert.equal(lastJsdoc.start.column, 1);
  assert.equal(lastJsdoc.end.line, 55);
  assert.equal(lastJsdoc.end.column, 42);
  assert.equal(lastJsdoc.params![0].name!.content, 'hello');
  assert.equal(lastJsdoc.params![0].type!.start.line, 55);
  assert.equal(lastJsdoc.params![0].type!.end.line, 55);
  assert.equal(lastJsdoc.params![0].type!.start.column, 11);
  assert.equal(lastJsdoc.params![0].type!.end.column, 34);

  // Make sure that a JSDoc description without a type annotation
  // doesn't cause the type to be forced to `Any`
  const undescribedVar = jsdocsFile.getReferenceAt(42, 11)!.item;
  ok(undescribedVar);
  assert.equal(undescribedVar.type.kind, 'String');

  const describedVar = jsdocsFile.getReferenceAt(44, 11)!.item;
  ok(describedVar);
  assert.equal(describedVar.type.kind, 'String');
}

function validateWithContexts(project: Project) {
  const complicatedScriptFile = project.getAssetByName('Complicated')!.gmlFile;
  const withingScript = project.getAssetByName('Withing')!;
  const withingScriptFile = withingScript.gmlFile;
  ok(withingScript);
  ok(withingScriptFile);
  ok(complicatedScriptFile);

  // WITHING INTO A GLOBAL CONSTRUCTED
  const bschemaGlobalContext = complicatedScriptFile.getReferenceAt(1, 14)!.item
    .type.type[0];
  ok(
    bschemaGlobalContext &&
      bschemaGlobalContext.kind === 'Struct' &&
      bschemaGlobalContext.name === 'Bschema',
  );
  const withIntoBschemaGlobal = withingScriptFile.getScopeRangeAt(2, 15)!;
  ok(
    withIntoBschemaGlobal &&
      withIntoBschemaGlobal.self === bschemaGlobalContext,
  );

  // WITHING INTO AN OBJECT IDENTIFIER
  const obj = project.getAssetByName('o_object')!;
  ok(obj && obj.instanceType);
  const withIntoObject = withingScriptFile.getScopeRangeAt(6, 16)!;
  ok(withIntoObject && withIntoObject.self === obj.assetType);

  // TYPE TEXT
  const typeTextRef = withingScriptFile.getReferenceAt(10, 20)!;
  ok(typeTextRef);
  assert.equal(typeTextRef.text, 'Id.Instance.o_object');
  assert.equal(typeTextRef.isRenameable, true);
  assert.equal(typeTextRef.toRenamed('new_name'), 'Id.Instance.new_name');

  // WITHING INTO AN OBJECT INSTANCE
  const instanceVarRef = withingScriptFile.getReferenceAt(11, 11)!;
  const instanceVar = instanceVarRef.item;
  ok(instanceVar && instanceVar.type.type[0] === obj.instanceType);
  assert.equal(instanceVarRef.text, 'o_instance');
  assert.equal(instanceVarRef.isRenameable, true);
  const withIntoInstance = withingScriptFile.getScopeRangeAt(13, 18)!;
  ok(withIntoInstance && withIntoInstance.self === obj.instanceType);

  // WITHING USING A JSDOC CONTEXT
  const withIntoJsdoc = withingScriptFile.getScopeRangeAt(20, 25)!;
  ok(withIntoJsdoc && withIntoJsdoc.self === obj.instanceType);

  // WITHING INTO LOCAL STRUCT
  const localStruct = withingScriptFile.getReferenceAt(24, 9)!.item;
  ok(localStruct && localStruct.type.kind === 'Struct');
  const withIntoLocalStruct = withingScriptFile.getScopeRangeAt(27, 16)!;
  ok(
    withIntoLocalStruct &&
      withIntoLocalStruct.self === localStruct.type.type[0],
  );

  // The following JSDoc was misbehaving at one point...
  const jsdoc = withingScriptFile.jsdocs[0];
  ok(jsdoc);
  assert.equal(jsdoc.type?.content, 'Id.Instance.o_object');
  assert.equal(jsdoc.type?.start.column, 12);
}

function validateBschemaConstructor(project: Project) {
  const complexScript = project.getAssetByName('Complicated')!;
  const complexScriptFile = complexScript.gmlFile;
  const bschemaGlobal = project.self.getMember('BSCHEMA');
  const bschemaStructType = project.types.get(
    'Struct.Bschema',
  ) as Type<'Struct'>;
  const bschemaGlobalDef = complexScriptFile.getReferenceAt(1, 15);
  const bschemaConstructor = complexScriptFile.getReferenceAt(7, 13)
    ?.item as Signifier;
  const bschemaRoleType = project.types.get(
    'Struct.BschemaRole',
  ) as Type<'Struct'>;
  ok(bschemaGlobal);
  ok(bschemaStructType);
  ok(bschemaStructType.kind === 'Struct');
  ok(bschemaGlobalDef);
  ok(bschemaGlobalDef.item === bschemaGlobal);
  ok(bschemaConstructor);
  ok(bschemaConstructor.type.kind === 'Function');
  assert.equal(bschemaConstructor.type.type[0].name, 'Bschema');
  ok(bschemaConstructor.type.constructs[0] === bschemaStructType);
  ok(bschemaRoleType);
  // Check all of the members of Struct.Bschema.

  // Make sure that the project_setup Bschema field gets typed based on its assignment
  const projectSetupAssignedTo =
    bschemaConstructor.type.type[0].getParameter(0)!;
  ok(projectSetupAssignedTo.name === 'project_setup_function');
  // ok(projectSetupType === projectSetupAssignedTo.type);

  // Check the types of all of the fields of the Bschema struct
  const expectedKinds = {
    base: { kind: 'Struct' },
    changes: { kind: 'Any' },
    clear_changes: { kind: 'Function' },
    commit_id_prefix: { kind: 'String' },
    commitId: { kind: 'String' },
    create_commit_id: { kind: 'Function' },
    create_role: { kind: 'Function' },
    force_use_packed: { kind: 'Bool' },
    init: { kind: 'Function' },
    latest_commitId: {
      kinds: ['String', 'Undefined'],
      code: 'String|Undefined',
    },
    latest: { kind: 'String' },
    next_commit_id: { kind: 'Function' },
    packed_commitId: {
      kinds: ['String', 'Undefined'],
      code: 'String|Undefined',
    },
    project_setup: { kind: 'Function' },
    roles: { kind: 'Struct', code: 'Struct<Struct.BschemaRole>' },
    schema_mote_ids: { kind: 'Struct', code: 'Struct<Array<String>>' },
    uid_pools: { kind: 'Struct' },
  } satisfies Record<
    string,
    { kind?: PrimitiveName; kinds?: PrimitiveName[]; code?: string }
  >;

  for (const [fieldName, info] of Object.entries(expectedKinds)) {
    logger.log('Checking field', fieldName, 'of Bschema');
    const member = bschemaStructType.getMember(fieldName);
    const type = member?.type;
    ok(member, `Expected to find member ${fieldName}`);
    ok(type, `Expected to find type for member ${fieldName}`);
    assert.equal(member.name, fieldName);
    if ('kind' in info) {
      assert.equal(type.kind, info.kind);
    }
    assert.ok(
      member.def != null,
      'All members should have a definition location',
    );
    if ('kinds' in info) {
      assert.equal(type?.type.length, info.kinds.length);
      for (const expectedKind of info.kinds) {
        assert.equal(
          type?.type.some((t) => t.kind === expectedKind),
          true,
          `Type ${expectedKind} not found in Union`,
        );
      }
    }
    if ('code' in info) {
      assert.equal(type.toFeatherString(), info.code);
    }
  }

  // Deeper checks on the types of some of the fields
  //#region Bschema.schema_mote_ids
  const schemaMoteIds = bschemaStructType.getMember('schema_mote_ids')!;
  assert.equal(schemaMoteIds.type.kind, 'Struct');
  assert.ok(schemaMoteIds.type.items != null);
  assert.equal(schemaMoteIds.type.items[0].kind, 'Array');
  assert.ok(schemaMoteIds.type.items[0].type[0].items != null);
  assert.equal(schemaMoteIds.type.items[0].type[0].items!.kind, 'String');
  assert.equal(schemaMoteIds.type.toFeatherString(), 'Struct<Array<String>>');
  //#endregion Bschema.schema_mote_ids

  //#region Bschema.roles
  const roles = bschemaStructType.getMember('roles')!;
  assert.equal(roles.type.kind, 'Struct');
  assert.ok(roles.type.items[0] != null);
  assert.equal(roles.type.items[0].kind, 'Struct');
  ok(roles.type.items[0].type[0] === bschemaRoleType);
  //#endregion Bschema.roles
}
