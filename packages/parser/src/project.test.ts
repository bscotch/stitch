import { expect } from 'chai';
import { logger } from './logger.js';
import { Project } from './project.js';
import { Native } from './project.native.js';
import { Signifier } from './signifiers.js';
import { Type, TypeStore } from './types.js';
import type { PrimitiveName } from './types.primitives.js';
import { ok } from './util.js';

describe('Project', function () {
  it('can load the GML spec', async function () {
    const spec = await Native.from(undefined, new Type('Struct'), new Map());
    expect(spec).to.exist;

    // STRUCTS AND CONSTS
    const track = spec.types.get('Struct.Track');
    ok(track);
    ok(track.kind === 'Struct');

    const name = track.getMember('name');
    ok(name);
    expect(name.type.kind).to.equal('String');

    const visible = track.getMember('visible');
    ok(visible);
    expect(visible.type.kind).to.equal('Bool');

    const tracks = track.getMember('tracks');
    ok(tracks);
    expect(tracks.type.kind).to.equal('Array');
    expect(tracks.type.items[0].kind).to.equal('Struct');
    expect(tracks.type.items[0].type[0].parent!).to.eql(
      spec.types.get('Struct'),
    );
    expect(tracks.type.items[0].type[0]).to.eql(track);

    const keyframes = track.getMember('keyframes');
    ok(keyframes);
    expect(keyframes.type.kind).to.equal('Array');
    expect(keyframes.type.items[0].kind).to.equal('Struct');
    expect(keyframes.type.items[0].type[0].parent!).to.eql(
      spec.types.get('Struct'),
    );
    expect(keyframes.type.items[0].type[0]).to.eql(
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
    expect(depthSymbol.type.kind).to.equal('Real');

    // FUNCTIONS
    const scriptExecuteType = spec.types.get('Function.script_execute');
    const scriptExecuteSymbol = spec.globalSelf.getMember('script_execute');
    ok(scriptExecuteSymbol);
    ok(scriptExecuteSymbol.type.type[0] === scriptExecuteType);
    ok(scriptExecuteType);
    ok(scriptExecuteType.kind === 'Function');
    expect(scriptExecuteType.listParameters()).to.have.lengthOf(2);
    expect(scriptExecuteType.listParameters()![0].name).to.equal('scr');
    expect(scriptExecuteType.listParameters()![0].type.type).to.have.lengthOf(
      3,
    );
    expect(scriptExecuteType.listParameters()![0].type.type[0].kind).to.equal(
      'String',
    );
    expect(scriptExecuteType.listParameters()![0].type.type[1].kind).to.equal(
      'Function',
    );
    expect(scriptExecuteType.listParameters()![0].type.type[2].kind).to.equal(
      'Asset.GMScript',
    );
    expect(scriptExecuteType.listParameters()![1].name).to.equal('...');
  });

  it('can has fallback GmlSpec', async function () {
    await Project.fallbackGmlSpecPath.exists({ assert: true });
  });

  it('can parse a representative project', async function () {
    const projectDir = 'samples/project';
    const project = await Project.initialize(projectDir);
    ok(project);

    //#region ASSETS
    const script = project.getAssetByName('Script1')!;
    const scriptFile = script.gmlFile;
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
    expect(
      parent.instanceType?.listMembers().map((m) => m.name),
    ).to.include.members(parentVars);
    expect(
      child.instanceType?.listMembers().map((m) => m.name),
    ).to.include.members([...parentVars, ...childVars]);
    expect(
      grandchild.instanceType?.listMembers().map((m) => m.name),
    ).to.include.members([...parentVars, ...childVars, ...grandchildVars]);
    expect(
      child2.instanceType?.listMembers().map((m) => m.name),
    ).to.include.members(child2Vars);
    expect(
      child2.instanceType?.listMembers().map((m) => m.name),
    ).not.to.include.members(parentVars);

    //#endregion OBJECT INHERITANCE

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
    ok(item.def);
    ok(item.name === globalVarName);
    // The globalvar should have appropriate symbol and type info
    ok(item.$tag === 'Sym');
    ok(item.global === true);
    //#endregion GLOBALVARS

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
    expect(globalConstructor.type.kind).to.equal('Function');
    expect(globalConstructor.type.type[0].isConstructor).to.equal(true);
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
    const param = paramRef.item as Signifier;
    ok(param);
    ok(param.local);
    ok(param.parameter);
    expect(param.name).to.equal(paramName);
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
    ok(enumDef.item.name === enumName);
    ok(enumMemberDef);
    ok(enumMemberDef.item.name === enumMemberName);

    const enumRef = objCreate.getReferenceAt(3, 23);
    const enumMemberRef = objCreate.getReferenceAt(3, 38);
    ok(enumRef);
    ok(enumRef.item.name === enumName);
    ok(enumMemberRef);
    ok(enumMemberRef.item.name === enumMemberName);
    //#endregion ENUMS

    //#region RECOVERY
    const enumAutocompleteScope = recoveryScriptFile.getScopeRangeAt(3, 22);
    ok(enumAutocompleteScope);
    const enumAutocompleteList = recoveryScriptFile.getInScopeSymbolsAt(3, 22);
    ok(enumAutocompleteList);
    expect(enumAutocompleteList.length).to.equal(2);
    //#endregion RECOVERY

    //#region CONSTRUCTORS
    const constructorName = 'GlobalConstructor';
    const constructorDef = scriptFile.getReferenceAt(18, 17);
    const constructorSymbol = constructorDef!.item;
    const constructorType = constructorSymbol.type as TypeStore<'Function'>;
    ok(constructorDef);
    ok(constructorSymbol);
    ok(constructorType);
    ok(constructorSymbol.name === constructorName);
    ok(constructorSymbol instanceof Signifier);
    expect(constructorSymbol.type.kind).to.equal('Function');
    expect(constructorSymbol.type.type[0].isConstructor).to.equal(true);
    expect(constructorType.type[0].name).to.equal(constructorName);
    expect(constructorType.type[0].listParameters()).to.have.lengthOf(2);
    expect(constructorType.constructs[0].kind).to.equal('Struct');
    expect(constructorType.constructs[0].name).to.equal(constructorName);
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
    ok(dotAssignedRef.item.name === dotAssignedRefName);
    ok(dotAssignedType);
    ok(dotAssignedType.parent === obj.instanceType);
    //#endregion DOT ASSIGNMENTS

    // Check the return type of a function
    const functionDefRef = complexScriptFile.getReferenceAt(119, 22);
    expect((functionDefRef?.item as Signifier).type.returns[0].kind).to.equal(
      'Array',
    );

    validateBschemaConstructor(project);
    // Reprocess a file and ensure that the tests still pass
    await complexScriptFile.reload();
    logger.log('Re-running after reload...');
    validateBschemaConstructor(project);
  });

  xit('can parse sample project', async function () {
    const projectDir = process.env.GML_PARSER_SAMPLE_PROJECT_DIR;
    ok(
      projectDir,
      'A dotenv file should provide a path to a full sample project, as env var GML_PARSER_SAMPLE_PROJECT_DIR',
    );
    const project = await Project.initialize(projectDir);
  });
});

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
  expect(bschemaConstructor.type.type[0].name).to.equal('Bschema');
  ok(bschemaConstructor.type.constructs[0] === bschemaStructType);
  ok(bschemaRoleType);
  // Check all of the members of Struct.Bschema.

  // Make sure that the project_setup Bschema field gets typed based on its assignment
  const projectSetupRef = complexScriptFile.getReferenceAt(10, 10)!;
  const projectSetupVar = projectSetupRef.item as Signifier;
  const projectSetupType = projectSetupVar.type;
  const projectSetupAssignedTo =
    bschemaConstructor.type.type[0].getParameter(0)!;
  ok(projectSetupAssignedTo.name === 'project_setup_function');
  // ok(projectSetupType === projectSetupAssignedTo.type);

  // Check the types of all of the fields of the Bschema struct
  const expectedKinds = {
    base: { kind: 'Struct' },
    changes: { kind: 'Unknown' },
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
    latest: {
      kinds: ['String', 'Undefined'],
      code: 'String|Undefined',
    },
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
    expect(member.name).to.equal(fieldName);
    if ('kind' in info) {
      expect(type.kind).to.equal(info.kind);
    }
    expect(member.def, 'All members should have a definition location').to
      .exist;
    if ('kinds' in info) {
      expect(type?.type.length).to.equal(info.kinds.length);
      for (const expectedKind of info.kinds) {
        expect(
          type?.type.some((t) => t.kind === expectedKind),
          `Type ${expectedKind} not found in Union`,
        ).to.be.true;
      }
    }
    if ('code' in info) {
      expect(type.toFeatherString()).to.equal(info.code);
    }
  }

  // Deeper checks on the types of some of the fields
  //#region Bschema.schema_mote_ids
  const schemaMoteIds = bschemaStructType.getMember('schema_mote_ids')!;
  expect(schemaMoteIds.type.kind).to.equal('Struct');
  expect(schemaMoteIds.type.items).to.exist;
  expect(schemaMoteIds.type.items[0].kind).to.equal('Array');
  expect(schemaMoteIds.type.items[0].type[0].items).to.exist;
  expect(schemaMoteIds.type.items[0].type[0].items!.kind).to.equal('String');
  expect(schemaMoteIds.type.toFeatherString()).to.equal(
    'Struct<Array<String>>',
  );
  //#endregion Bschema.schema_mote_ids

  //#region Bschema.roles
  const roles = bschemaStructType.getMember('roles')!;
  expect(roles.type.kind).to.equal('Struct');
  expect(roles.type.items[0]).to.exist;
  expect(roles.type.items[0].kind).to.equal('Struct');
  ok(roles.type.items[0].type[0] === bschemaRoleType);
  //#endregion Bschema.roles
}
