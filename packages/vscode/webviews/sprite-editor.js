/**
 * @typedef {import('../src/spriteEditor.template.mjs').SpriteInfo} SpriteInfo
 */

/**
 * Defined upstream
 * @type {SpriteInfo} */
// @ts-ignore
const sprite = window.sprite;

const elements = {
  name: /** @type {HTMLElement} */ (document.querySelector('.name')),
  width: /** @type {HTMLElement} */ (document.querySelector('.dim.width')),
  height: /** @type {HTMLElement} */ (document.querySelector('.dim.height')),
  originPresets: /** @type {HTMLSelectElement} */ (
    document.getElementById('origin-presets')
  ),
  xorigin: /** @type {HTMLInputElement} */ document.querySelector(
    '#origin-presets + .xorigin input',
  ),
  yorigin: /** @type {HTMLInputElement} */ document.querySelector(
    '#origin-presets + .yorigin input',
  ),
  zoom: /** @type {HTMLInputElement} */ document.querySelector(
    '#origin-presets + .zoom input',
  ),
  frames: /** @type {HTMLOListElement} */ document.getElementById('frames'),
};

// Static data
elements.name.innerHTML = sprite.name;
elements.width.innerHTML = `${sprite.width}`;
elements.height.innerHTML = `${sprite.height}`;
