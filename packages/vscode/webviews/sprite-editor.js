/**
 * @typedef {import('../src/spriteEditor.template.mjs').SpriteInfo} SpriteInfo
 * @typedef {import('../src/extension.spriteEditor.mjs').SpriteEditedMessage} SpriteEditedMessage
 */

try {
  // @ts-ignore
  // eslint-disable-next-line no-undef
  window.vscode = acquireVsCodeApi();
} catch {
  console.log('Could not acquire vscode API.');
}

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

/**
 * @param {SpriteEditedMessage} message
 */
function sendToVscode(message) {
  if ('vscode' in window) {
    /** @type {any} */
    const vscode = window.vscode;
    vscode.postMessage(message);
  } else {
    console.error('vscode not in window, would have posted message: ', message);
  }
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
  originPresets: /** @type {HTMLSelectElement} */ (
    document.getElementById('origin-presets')
  ),
  xorigin: /** @type {HTMLInputElement} */ (
    document.querySelector('.xorigin input')
  ),
  yorigin: /** @type {HTMLInputElement} */ (
    document.querySelector('.yorigin input')
  ),
  zoom: /** @type {HTMLInputElement} */ (document.querySelector('.zoom input')),
  frames: /** @type {HTMLOListElement} */ (document.getElementById('frames')),
};

// Initial & static data
elements.name.innerHTML = sprite.name;
elements.width.innerHTML = `${sprite.width}`;
elements.height.innerHTML = `${sprite.height}`;
const initialZoom = Math.max(
  sprite.initialMinWidth / sprite.width,
  Math.min(512 / sprite.width, 1),
);

class FrameImage {
  /** @type {FrameImage[]} */
  static frames = [];
  static dims = {
    width: sprite.width,
    height: sprite.height,

    /** @private */
    _xorigin: sprite.xorigin,
    get xorigin() {
      return this._xorigin;
    },
    set xorigin(value) {
      this._xorigin = clamp(Math.floor(value), 0, this.width - 1);
      FrameImage.frames.forEach((f) => f.updateDot());
      elements.xorigin.value = `${this._xorigin}`;
      FrameImage.updateVscode();
    },

    /** @private */
    _yorigin: sprite.yorigin,
    get yorigin() {
      return this._yorigin;
    },
    set yorigin(value) {
      this._yorigin = clamp(Math.floor(value), 0, this.height - 1);
      FrameImage.frames.forEach((f) => f.updateDot());
      elements.yorigin.value = `${this._yorigin}`;
      FrameImage.updateVscode();
    },

    /** @private */
    _zoom: initialZoom,
    /** @param {number} zoom */
    set zoom(zoom) {
      this._zoom = zoom;
      FrameImage.frames.forEach((f) => f.zoom());
      elements.zoom.value = zoom.toFixed(1);
      document.documentElement.style.setProperty('--zoom', `${zoom}`);
    },
    get zoom() {
      return this._zoom;
    },

    displayWidth: sprite.width * initialZoom,
    displayHieght: sprite.height * initialZoom,
  };

  /** @param {string} uri  */
  constructor(uri) {
    FrameImage.frames.push(this);
    this.uri = uri;
    this.image = new Image();
    this.image.draggable = false;

    this.dot = document.createElement('div');
    this.dot.classList.add('crosshair');

    this.container = document.createElement('li');
    this.container.appendChild(this.image);
    this.container.appendChild(this.dot);

    elements.frames.appendChild(this.container);

    this.zoom();
    this.image.onload = () => {
      // Add click handler that will update the origin after normalizing the click position
      this.image.addEventListener('mousemove', (e) => {
        if (e.buttons !== 1) return;
        this.handleCrosshairEvent(e);
      });
      this.image.addEventListener('click', (e) => {
        this.handleCrosshairEvent(e);
      });
    };
    this.load();
  }

  /**
   * @param {MouseEvent} e
   * @private */
  handleCrosshairEvent(e) {
    const rect = e.target.getBoundingClientRect();
    assert(rect && typeof rect.left === 'number', 'Bounding rect not found');
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Normalize based on the zoom level
    FrameImage.dims.xorigin = x / FrameImage.dims.zoom;
    FrameImage.dims.yorigin = y / FrameImage.dims.zoom;
  }

  zoom() {
    const width = FrameImage.dims.width * FrameImage.dims.zoom;
    this.image.style.width = width + 'px';
    this.updateDot();
  }

  /** @private */
  load() {
    this.image.src = this.uri;
  }

  updateDot() {
    const x = FrameImage.dims.xorigin * FrameImage.dims.zoom;
    const y = FrameImage.dims.yorigin * FrameImage.dims.zoom;
    this.dot.style.left = x + 'px';
    this.dot.style.top = y + 'px';
  }
  static updateDot() {
    for (const f of FrameImage.frames) {
      f.updateDot();
    }
  }
  static updateVscode() {
    sendToVscode({
      spriteName: sprite.name,
      xorigin: FrameImage.dims.xorigin,
      yorigin: FrameImage.dims.yorigin,
    });
  }
}

// Zoom
elements.zoom.value = initialZoom.toFixed(1);
elements.zoom.addEventListener('change', (e) => {
  if (!e.target) return;
  FrameImage.dims.zoom = Math.max(+e.target.value, 0.1);
});

// Origin Presets
for (const vertical of ['Top', 'Middle', 'Bottom']) {
  for (const horizontal of ['Left', 'Center', 'Right']) {
    const name = vertical + horizontal;
    const xorigin =
      horizontal === 'Left'
        ? 0
        : horizontal === 'Center'
        ? Math.floor(FrameImage.dims.width / 2)
        : FrameImage.dims.width - 1;
    const yorigin =
      vertical === 'Top'
        ? 0
        : vertical === 'Middle'
        ? Math.floor(FrameImage.dims.height / 2)
        : FrameImage.dims.height - 1;
    // Add an option to the select
    const option = document.createElement('option');
    option.value = JSON.stringify({ xorigin, yorigin });
    option.innerText = name;
    elements.originPresets.appendChild(option);
  }
}
elements.originPresets.addEventListener('change', (e) => {
  const { xorigin, yorigin } = JSON.parse(e.target.value);
  FrameImage.dims.xorigin = +xorigin;
  FrameImage.dims.yorigin = +yorigin;
  // Reset the select to the initial value
  e.target.value = '';
});

// Origin Inputs
/** @type {['xorigin','yorigin']} */
const originNames = ['xorigin', 'yorigin'];
for (const origin of originNames) {
  elements[origin].value = `${FrameImage.dims[origin]}`;
  const max =
    origin === 'xorigin'
      ? FrameImage.dims.width - 1
      : FrameImage.dims.height - 1;
  elements[origin].setAttribute('max', `${max}`);
  elements[origin].addEventListener('change', (e) => {
    const value = Math.min(+e.target.value, max);
    FrameImage.dims[origin] = value;
  });
}

// Finally, create the frames
sprite.frameUrls.map((p) => new FrameImage(p));
