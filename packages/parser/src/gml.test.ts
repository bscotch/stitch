import { ok } from 'assert';
import { expect } from 'chai';
import { ProjectTypes } from './project.impl.js';

describe.only('GML', function () {
  it('can load the GML spec', async function () {
    const spec = await ProjectTypes.from();
    expect(spec).to.exist;
    // Check a few things that we expect to be in the spec.
    const track = spec.types.get('Struct.Track');
    // <Field Name="name" Type="String" Get="true" Set="true" />
    // <Field Name="type" Type="Constant.SequenceTrackType" Get="true" Set="true" />
    // <Field Name="tracks" Type="Array[Struct.Track]" Get="true" Set="true" />
    // <Field Name="visible" Type="Bool" Get="true" Set="true" />
    // <Field Name="keyframes" Type="Array[Struct.Keyframe]" Get="true" Set="true" />
    ok(track);

    const name = track.getMember('name');
    ok(name);
    expect(name.type.kind).to.equal('String');

    const visible = track.getMember('visible');
    ok(visible);
    expect(visible.type.kind).to.equal('Bool');

    const tracks = track.getMember('tracks');
    ok(tracks);
    expect(tracks.type.kind).to.equal('Array');
    console.dir(tracks.type.items);
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
    expect(type.type.kind).to.equal('Union');
  });
});
