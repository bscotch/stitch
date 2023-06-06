import { omit } from '@bscotch/utility';
import { ok } from 'assert';
import { expect } from 'chai';
import { Project } from './project.js';
import { Native } from './project.native.js';
import { Symbol } from './project.symbol.js';
import { TypeMember } from './project.type.js';

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
    expect(scriptExecuteType.params).to.have.lengthOf(2);
    expect(scriptExecuteType.params![0].name).to.equal('scr');
    expect(scriptExecuteType.params![0].type.kind).to.equal('Union');
    expect(scriptExecuteType.params![0].type.types).to.have.lengthOf(3);
    expect(scriptExecuteType.params![0].type.types![0].kind).to.equal('String');
    expect(scriptExecuteType.params![0].type.types![1].kind).to.equal(
      'Function',
    );
    expect(scriptExecuteType.params![0].type.types![2].kind).to.equal(
      'Asset.GMScript',
    );
    expect(scriptExecuteType.params![1].name).to.equal('...');
  });

  it('can has fallback GmlSpec', async function () {
    await Project.fallbackGmlSpecPath.exists({ assert: true });
  });

  it('can parse a representative project', async function () {
    const projectDir = 'samples/project';
    const project = await Project.initialize(projectDir);
    ok(project);

    //#region OBJECT INHERITANCE
    // Child1 and Child2 both inherit from Parent
    // Child1Child inherits from Child1
    // Child2 does not call event_inherited in its Create event
    const parent = project.getAssetByName('o_parent')!;
    const parentVars = ['parent_var'];
    const child = project.getAssetByName('o_child1')!;
    const childVars = ['child1_var'];
    const grandchild = project.getAssetByName('o_child1_child')!;
    const grandchildVars = ['child1_child_var'];
    const child2 = project.getAssetByName('o_child2')!;
    const child2Vars = ['child2_var'];
    ok(parent);
    ok(child);
    ok(grandchild);
    ok(child2);
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

    //#region ASSETS
    const script = project.getAssetByName('Script1')!;
    const scriptFile = script.gmlFile;
    const recoveryScript = project.getAssetByName('Recovery')!;
    const recoveryScriptFile = recoveryScript.gmlFile;
    const obj = project.getAssetByName('o_object')!;
    const objCreate = obj.gmlFilesArray.find((f) => f.name === 'Create_0');
    const objStep = obj.gmlFilesArray.find((f) => f.name === 'Step_0');
    ok(script);
    ok(scriptFile);
    ok(obj);
    ok(objCreate);
    ok(objStep);
    ok(recoveryScript);
    ok(recoveryScriptFile);
    //#endregion ASSETS

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
    const functionScope = scriptFile.getScopeRangeAt(19, 16);
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
  });

  xit('can parse sample project', async function () {
    const projectDir = process.env.GML_PARSER_SAMPLE_PROJECT_DIR;
    ok(
      projectDir,
      'A dotenv file should provide a path to a full sample project, as env var GML_PARSER_SAMPLE_PROJECT_DIR',
    );
    const project = await Project.initialize(projectDir);

    const asset = project.getAssetByName('button_cl2_confirmation');
    ok(asset);
    const create = asset.gmlFilesArray.find((f) => f.name === 'Draw_64');
    ok(create);

    const sample = project.getAssetByName('ZoneDapples');
    ok(sample);
    const file = sample.gmlFile;
    ok(file);
    const scopes = file.scopes;
    ok(scopes);
    const positions = scopes.map((scope) => {
      const start = omit(scope.start, ['file', '$tag']);
      const end = omit(scope.end, ['file', '$tag']);
      return { start, end };
    });
    const sym = file.getReferenceAt(206);
    ok(sym);

    const arg = file.getFunctionArgRangeAt(326);
    expect(arg?.param.name).to.equal('n1');

    const arg2 = file.getFunctionArgRangeAt(865);
    ok(arg2);
    expect(arg2.param.parent.name).to.equal('sin');

    const quickStructSymbol = file.getReferenceAt(1100);
    ok(quickStructSymbol);
  });
});
