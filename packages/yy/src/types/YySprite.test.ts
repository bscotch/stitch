import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Yy } from '../Yy.ts';
import type { YySprite } from './YySprite.ts';

type NumberLike = number;

function expectEqualNumbers(a: NumberLike, b: NumberLike, message?: string) {
  assert.ok(a != null);
  assert.ok(b != null);
  assert.equal(+a, +b, message);
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
    assert.equal(
      frames[i].name,
      keyframes[i].Channels!['0'].Id!.name,
      `Frame name should be found in the index-matched Keyframe`,
    );
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
    assert.equal(sprite.name, 'my_sprite');
    assert.equal(sprite.frames.length, 0);
    assert.equal(sprite.layers.length, 1);
    assert.equal(typeof sprite.layers[0].name, 'string');
    assert.ok(sprite.layers[0].name.length > 0);
    assert.equal(sprite.sequence.tracks.length, 1);
    assert.equal(sprite.sequence.tracks[0].keyframes.Keyframes.length, 0);
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
        name: crypto.randomUUID(),
      },
    ];
    // Add some frames
    for (const [i, frame] of frames.entries()) {
      sprite.frames.push(frame as any);
      sprite = Yy.populate(sprite, 'sprites');
      if (frame.name) {
        assert.equal(sprite.frames[i].name, frame.name);
      }
      const keyframes = sprite.sequence.tracks[0].keyframes.Keyframes;
      assert.equal(keyframes.length, i + 1);
      expectFramesToMatchKeyframes(sprite);
    }
  });
  it('can delete a frame', function () {
    const initialFrames = [{}, {}, {}];
    let sprite = Yy.populate(
      {
        name: 'my_sprite',
        frames: initialFrames as any,
      },
      'sprites',
    );
    expectEqualLengths(sprite.frames, initialFrames);
    expectFramesToMatchKeyframes(sprite);
    // Delete each frame in turn starting from the end
    for (let i = sprite.frames.length - 1; i >= 0; i--) {
      sprite.frames.splice(i, 1);
      sprite = Yy.populate(sprite, 'sprites');
      assert.equal(sprite.frames.length, i);
      expectFramesToMatchKeyframes(sprite);
    }
  });
});
