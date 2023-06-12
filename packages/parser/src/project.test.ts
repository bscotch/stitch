import { expect } from 'chai';
import { Project } from './project.js';
import { Native } from './project.native.js';
import { Symbol } from './project.symbol.js';
import { Type, TypeMember } from './project.type.js';
import { ok } from './util.js';

describe('Project', function () {
  it('can load the GML spec', async function () {
    const spec = await Native.from();
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
    expect(tracks.type.items!.kind).to.equal('Struct');
    expect(tracks.type.items!.parent!).to.eql(spec.types.get('Struct'));
    expect(tracks.type.items!).to.eql(track);

    const keyframes = track.getMember('keyframes');
    ok(keyframes);
    expect(keyframes.type.kind).to.equal('Array');
    expect(keyframes.type.items!.kind).to.equal('Struct');
    expect(keyframes.type.items!.parent!).to.eql(spec.types.get('Struct'));
    expect(keyframes.type.items!).to.eql(spec.types.get('Struct.Keyframe'));

    const type = track.getMember('type');
    ok(type);
    const expectedTypeType = spec.types.get('Constant.SequenceTrackType');
    ok(expectedTypeType);
    ok(type.type === expectedTypeType);
    ok(expectedTypeType.kind === 'Real');

    // VARIABLES
    const depthSymbol = spec.instance.get('depth');
    ok(depthSymbol);
    expect(depthSymbol.type.kind).to.equal('Real');

    // FUNCTIONS
    const scriptExecuteType = spec.types.get('Function.script_execute');
    const scriptExecuteSymbol = spec.global.get('script_execute');
    ok(scriptExecuteSymbol);
    ok(scriptExecuteSymbol.type === scriptExecuteType);
    ok(scriptExecuteType.kind === 'Function');
    expect(scriptExecuteType.listParameters()).to.have.lengthOf(2);
    expect(scriptExecuteType.listParameters()![0].name).to.equal('scr');
    expect(scriptExecuteType.listParameters()![0].type.kind).to.equal('Union');
    expect(scriptExecuteType.listParameters()![0].type.types).to.have.lengthOf(
      3,
    );
    expect(scriptExecuteType.listParameters()![0].type.types![0].kind).to.equal(
      'String',
    );
    expect(scriptExecuteType.listParameters()![0].type.types![1].kind).to.equal(
      'Function',
    );
    expect(scriptExecuteType.listParameters()![0].type.types![2].kind).to.equal(
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
    ok(item.type.name === globalVarName);
    ok(item.global === true);
    ok(item.type.global === true);
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
    ) as Symbol;
    ok(globalConstructor);
    ok(!globalConstructor.local);
    ok(globalConstructor.global);
    ok(globalConstructor.name === 'GlobalConstructor');
    ok(globalConstructor.type.constructs);
    ok(globalConstructor.type.constructs.name === 'GlobalConstructor');
    ok(globalConstructor.type.isFunction);
    expect(globalConstructor.type.kind).to.equal('Constructor');
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
    const param = paramRef.item as TypeMember;
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
    const constructorSymbol = constructorDef!.item as Symbol;
    const constructorType = constructorSymbol.type as Type<'Constructor'>;
    ok(constructorDef);
    ok(constructorSymbol);
    ok(constructorType);
    ok(constructorSymbol.name === constructorName);
    ok(constructorSymbol instanceof Symbol);
    expect(constructorSymbol.type.kind).to.equal('Constructor');
    expect(constructorType.name).to.equal(constructorName);
    expect(constructorType.listParameters()).to.have.lengthOf(2);
    expect(constructorType.constructs).to.exist;
    expect(constructorType.constructs!.kind).to.equal('Struct');
    expect(constructorType.constructs!.name).to.equal(constructorName);
    ok(project.getGlobal(constructorName)?.symbol === constructorSymbol);
    ok(
      project.types.get(`Struct.${constructorName}`) ===
        constructorType.constructs,
    );

    //#endregion CONSTRUCTORS

    //#region FUNCTION CALLS
    ok(!scriptFile.getFunctionArgRangeAt(29, 35)!.hasExpression);
    ok(scriptFile.getFunctionArgRangeAt(41, 50)!.hasExpression);
    //#endregion FUNCTION CALLS

    //#region DOT ASSIGNMENTS
    const dotAssignedRefName = 'another_instance_variable';
    const dotAssignedRef = objCreate.getReferenceAt(20, 14);
    const dotAssignedType = dotAssignedRef?.item as TypeMember;
    ok(dotAssignedRef);
    ok(dotAssignedRef.item.name === dotAssignedRefName);
    ok(dotAssignedType);
    ok(dotAssignedType.parent === obj.instanceType);
    //#endregion DOT ASSIGNMENTS
  });

  it('can parse sample project', async function () {
    const projectDir = process.env.GML_PARSER_SAMPLE_PROJECT_DIR;
    ok(
      projectDir,
      'A dotenv file should provide a path to a full sample project, as env var GML_PARSER_SAMPLE_PROJECT_DIR',
    );
    const project = await Project.initialize(projectDir);
  });
});
