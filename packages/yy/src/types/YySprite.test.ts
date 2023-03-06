import { expect } from 'chai';
import { v4 as uuid4 } from 'uuid';
import { Yy } from '../Yy.js';
import { FixedNumber } from './utility.js';
import { YySprite } from './YySprite.js';

type NumberLike = number | FixedNumber;

function expectEqualNumbers(a: NumberLike, b: NumberLike, message?: string) {
  expect(a).to.exist;
  expect(b).to.exist;
  expect(+a, message).to.equal(+b);
}

function expectEqualLengths<
  T extends { length: NumberLike },
  U extends { length: NumberLike },
>(a: T, b: U, message?: string) {
  return expectEqualNumbers(a.length, b.length, message);
}

function expectFramesToMatchKeyframes(sprite: YySprite) {
  const frames = sprite.frames!;
  const keyframes = sprite.sequence.tracks[0].keyframes!.Keyframes!;
  expectEqualLengths(frames, keyframes);
  expectEqualLengths(frames, sprite.sequence);
  for (let i = 0; i < frames.length; i++) {
    expect(
      frames[i].name,
      `Frame name should be found in the index-matched Keyframe`,
    ).to.equal(keyframes[i].Channels!['0'].Id!.name);
    expectEqualNumbers(
      keyframes[i].Key!,
      i,
      `Keyframe 'Key' field should match its index position.`,
    );
  }
}

describe('YySprite', function () {
  it('can create a sprite sparsely', function () {
    // Will throw if unsuccessful (though success doesn't guarantee correctness!)
    const sprite = Yy.populate(
      {
        name: 'my_sprite',
      },
      'sprites',
    );
    expect(sprite.name).to.equal('my_sprite');
    expect(sprite.frames.length).to.equal(0);
    expect(sprite.layers.length).to.equal(1);
    expect(sprite.layers[0].name).to.be.a('string').and.have.length.above(0);
    expect(sprite.sequence.tracks).to.have.length(1);
    expect(sprite.sequence.tracks[0].keyframes.Keyframes.length).to.equal(0);
  });
  it('can add frames', function () {
    // Create a new sprite.
    let sprite = Yy.populate(
      {
        name: 'my_sprite',
      },
      'sprites',
    );
    const frames = [
      // One without any info yet
      {},
      // One with a frameGuid
      {
        name: uuid4(),
      },
    ];
    // Add some frames
    for (const [i, frame] of frames.entries()) {
      sprite.frames.push(frame as any);
      sprite = Yy.populate(sprite, 'sprites');
      if (frame.name) {
        expect(sprite.frames[i].name).to.equal(frame.name);
      }
      const keyframes = sprite.sequence.tracks[0].keyframes.Keyframes;
      expect(keyframes.length).to.equal(i + 1);
      expectFramesToMatchKeyframes(sprite);
    }
  });
  it('can delete a frame', function () {
    const initialFrames = [{}, {}, {}];
    let sprite = Yy.populate(
      {
        name: 'my_sprite',
        frames: initialFrames,
      },
      'sprites',
    );
    expectEqualLengths(sprite.frames, initialFrames);
    expectFramesToMatchKeyframes(sprite);
    // Delete each frame in turn starting from the end
    for (let i = sprite.frames.length - 1; i >= 0; i--) {
      sprite.frames.splice(i, 1);
      sprite = Yy.populate(sprite, 'sprites');
      expect(sprite.frames.length).to.equal(i);
      expectFramesToMatchKeyframes(sprite);
    }
  });
});
