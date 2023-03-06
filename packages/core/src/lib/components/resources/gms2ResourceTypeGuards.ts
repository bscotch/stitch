import type { Gms2ResourceSubclass } from '../Gms2ResourceArray.js';
import type { Gms2Animation } from './Gms2Animation.js';
import type { Gms2Extension } from './Gms2Extension.js';
import type { Gms2Font } from './Gms2Font.js';
import type { Gms2Note } from './Gms2Note.js';
import type { Gms2Object } from './Gms2Object.js';
import type { Gms2Path } from './Gms2Path.js';
import type { Gms2Room } from './Gms2Room.js';
import type { Gms2Script } from './Gms2Script.js';
import type { Gms2Sequence } from './Gms2Sequence.js';
import type { Gms2Shader } from './Gms2Shader.js';
import type { Gms2Sound } from './Gms2Sound.js';
import type { Gms2Sprite } from './Gms2Sprite.js';
import type { Gms2Tileset } from './Gms2Tileset.js';
import type { Gms2Timeline } from './Gms2Timeline.js';

export function isGms2Animation(
  instance: Gms2ResourceSubclass,
): instance is Gms2Animation {
  return instance.type === 'animcurves';
}
export function isGms2Extension(
  instance: Gms2ResourceSubclass,
): instance is Gms2Extension {
  return instance.type === 'extensions';
}
export function isGms2Font(
  instance: Gms2ResourceSubclass,
): instance is Gms2Font {
  return instance.type === 'fonts';
}
export function isGms2Note(
  instance: Gms2ResourceSubclass,
): instance is Gms2Note {
  return instance.type === 'notes';
}
export function isGms2Object(
  instance: Gms2ResourceSubclass,
): instance is Gms2Object {
  return instance.type === 'objects';
}
export function isGms2Path(
  instance: Gms2ResourceSubclass,
): instance is Gms2Path {
  return instance.type === 'paths';
}
export function isGms2Room(
  instance: Gms2ResourceSubclass,
): instance is Gms2Room {
  return instance.type === 'rooms';
}
export function isGms2Script(
  instance: Gms2ResourceSubclass,
): instance is Gms2Script {
  return instance.type === 'scripts';
}
export function isGms2Sequence(
  instance: Gms2ResourceSubclass,
): instance is Gms2Sequence {
  return instance.type === 'sequences';
}
export function isGms2Shader(
  instance: Gms2ResourceSubclass,
): instance is Gms2Shader {
  return instance.type === 'shaders';
}
export function isGms2Sound(
  instance: Gms2ResourceSubclass,
): instance is Gms2Sound {
  return instance.type === 'sounds';
}
export function isGms2Sprite(
  instance: Gms2ResourceSubclass,
): instance is Gms2Sprite {
  return instance.type === 'sprites';
}
export function isGms2Tileset(
  instance: Gms2ResourceSubclass,
): instance is Gms2Tileset {
  return instance.type === 'tilesets';
}
export function isGms2Timeline(
  instance: Gms2ResourceSubclass,
): instance is Gms2Timeline {
  return instance.type === 'timelines';
}
