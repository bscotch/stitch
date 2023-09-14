/**
 * @typedef {import('../src/spriteEditor.template.mjs').SpineSpriteInfo} SpriteInfo
 * @typedef {import('../src/extension.spriteEditor.mjs').SpriteEditedMessage} SpriteEditedMessage
 * @typedef {import('@esotericsoftware/spine-player').SpinePlayer} SpinePlayer
 * @typedef {import('@esotericsoftware/spine-player').SpinePlayerConfig} SpinePlayerConfig
 */

try {
  // @ts-ignore
  // eslint-disable-next-line no-undef
  window.vscode = acquireVsCodeApi();
} catch {
  console.log('Could not acquire vscode API.');
}

/**
 * @param {HTMLElement} where
 * @param {SpinePlayerConfig} config
 * @returns {SpinePlayer}
 */
function createSpinePlayer(where, config) {
  const player = new spine.SpinePlayer(where, config);
  return player;
}

/**
 * Defined upstream
 * @type {SpriteInfo} */
// @ts-ignore
const sprite = window.sprite;

const elements = {
  name: /** @type {HTMLElement} */ (document.querySelector('.name')),
  width: /** @type {HTMLElement} */ (document.querySelector('.dim.width')),
  height: /** @type {HTMLElement} */ (document.querySelector('.dim.height')),
  xorigin: /** @type {HTMLElement} */ (document.querySelector('.origin.x')),
  yorigin: /** @type {HTMLElement} */ (document.querySelector('.origin.y')),
  player: /** @type {HTMLElement} */ (
    document.querySelector('#player-container')
  ),
};

// Initial & static data
elements.name.innerHTML = sprite.name;
elements.width.innerHTML = `${sprite.width}`;
elements.height.innerHTML = `${sprite.height}`;
elements.xorigin.innerHTML = `${sprite.xorigin}`;
elements.yorigin.innerHTML = `${sprite.yorigin}`;

// Embed the Spine player
const player = createSpinePlayer(elements.player, {
  jsonUrl: sprite.spine.json,
  atlasUrl: sprite.spine.atlas,
  preserveDrawingBuffer: true,
  premultipliedAlpha: false,
  rawDataURIs: sprite.spineDataUris,
});

/**
 * @param {any} condition
 * @param {string} message
 * @returns {asserts condition}
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * @template T
 * @param {T} value
 * @returns {Exclude<T, undefined|null>}
 */
function defined(value) {
  return /** @type {Exclude<T, undefined|null>}*/ (value);
}

/**
 * Clamps a value between a minimum and maximum value.
 *
 * @param {number} value - The input value to be clamped.
 * @param {number} min - The lower boundary to clamp the value to.
 * @param {number} max - The upper boundary to clamp the value to.
 * @returns {number} - The clamped value.
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
