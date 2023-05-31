import { omit } from '@bscotch/utility';
import { ok } from 'assert';
import { expect } from 'chai';
import { Project } from './project.js';
import { Native } from './project.native.js';

describe.only('Project', function () {
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

  it('can parse sample project', async function () {
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
