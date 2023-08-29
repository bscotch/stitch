import type { Asset } from '@bscotch/gml-parser';
import vscode from 'vscode';
import { html } from './lib.mjs';

const css = html`
  <style>
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    :root {
      --color-lts: #ff8652;
      --color-stable: #ae89ff;
      --color-beta: #569cff;
      --color-unstable: rgb(169, 169, 169);
      --color-background: #0e0e0e;
      --color-text: #ffffff;
      --color-text-muted: rgb(169, 169, 169);
    }
    body {
      font-size: var(--vscode-editor-font-size);
      background-color: var(--color-background);
      color: var(--color-text);
    }
    a[role='button'] {
      cursor: pointer;
    }
    details > summary {
      cursor: pointer;
      user-select: none;
    }
    h1 {
      font-size: 1.4em;
    }
    h2 {
      font-size: 1.25em;
    }
    h3 {
      font-size: 1.15em;
    }
    h4 {
      font-size: 1.08em;
    }
    h2,
    h3,
    h4 {
      margin: 0;
    }
    #frames {
      display: flex;
      flex-wrap: wrap;
      gap: 1em;
    }
    #frames li {
      list-style: none;
      position: relative;
      user-select: none;
    }
    #frames img {
      min-width: 10em;
      position: relative;
      border: 1px solid white;
      user-select: none;
      cursor: pointer;
    }
    .crosshair {
      width: 1em;
      height: 1em;
      background-color: transparent;
      position: absolute;
      transform: translate(-0.5em, -0.5em);
    }

    .crosshair::before,
    .crosshair::after {
      content: '';
      position: absolute;
      background-color: red;
    }

    .crosshair::before {
      width: 2px;
      height: 100%;
      left: 50%;
      transform: translateX(-50%);
    }

    .crosshair::after {
      width: 100%;
      height: 2px;
      top: 50%;
      transform: translateY(-50%);
    }
  </style>
`;

function createScript(sprite: Asset<'sprites'>, panel: vscode.WebviewPanel) {
  const frameUris = sprite.framePaths.map((p) =>
    panel.webview.asWebviewUri(vscode.Uri.file(p.absolute)),
  );
  const { xorigin, yorigin } = sprite.yy.sequence;
  const { width, height } = sprite.yy;
  const frameUrisArrayString = `[${frameUris
    .map((u) => `"${u.toString()}"`)
    .join(',')}]`;
  return html`
    <script>
      const vscode = acquireVsCodeApi();
      const imagePaths = ${frameUrisArrayString};
      const size = {
        naturalWidth: ${width},
        naturalHeight: ${height},
        width: 0,
        height: 0,
        xorigin: ${xorigin},
        yorigin: ${yorigin},
      };
      const inputs = {
        xorigin: document.querySelector('.xorigin input'),
        yorigin: document.querySelector('.yorigin input'),
      };
      for (const [name, input] of Object.entries(inputs)) {
        input.value = size[name];
        const max =
          name === 'xorigin' ? size.naturalWidth - 1 : size.naturalHeight - 1;
        input.setAttribute('max', max);
        input.addEventListener('change', (e) => {
          const value = Math.min(+e.target.value, max);
          size[name] = value;
          const scalar = size.width / size.naturalWidth;
          for (const f of frames) {
            f.moveDot(size.xorigin * scalar, size.yorigin * scalar);
          }
          onUpdateOrigin();
        });
      }

      function onUpdateOrigin() {
        vscode.postMessage({ type: 'originChange', ...size });
      }

      class FrameImage {
        constructor(uri) {
          this.uri = uri;
          this.image = new Image();

          this.dot = document.createElement('div');
          this.dot.classList.add('crosshair');

          this.container = document.createElement('li');
          this.container.appendChild(this.image);
          this.container.appendChild(this.dot);

          document.getElementById('frames').appendChild(this.container);
        }

        load() {
          this.image.src = this.uri;
        }

        moveDot(x, y) {
          this.dot.style.left = x + 'px';
          this.dot.style.top = y + 'px';
        }
      }
      const frames = imagePaths.map((p) => new FrameImage(p));
      // Load the images and get their sizes
      frames.forEach((frame) => {
        frame.image.onload = () => {
          size.naturalWidth = frame.image.naturalWidth;
          size.naturalHeight = frame.image.naturalHeight;
          size.width = frame.image.width;
          size.height = frame.image.height;
          const scalar = size.width / size.naturalWidth;
          frame.moveDot(size.xorigin * scalar, size.yorigin * scalar);

          // Add click handler that will update the origin after normalizing the click position
          frame.image.addEventListener('click', (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const scalar = size.width / size.naturalWidth;
            for (const f of frames) {
              f.moveDot(x, y);
            }
            const xnorm = Math.floor((x / size.width) * size.naturalWidth);
            const ynorm = Math.floor((y / size.height) * size.naturalHeight);
            size.xorigin = xnorm;
            size.yorigin = ynorm;
            inputs.xorigin.value = xnorm;
            inputs.yorigin.value = ynorm;
            onUpdateOrigin();
          });
        };
        frame.load();
      });
    </script>
  `;
}

export function compile(sprite: Asset<'sprites'>, panel: vscode.WebviewPanel) {
  return html`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      ${css}
      <body>
        <h1>${sprite.name}</h1>
        <section>
          <h2>Origin</h2>
          <label class="xorigin"
            >xorigin <input type="number" step="1" min="0"
          /></label>
          <label class="yorigin"
            >yorigin <input type="number" step="1" min="0"
          /></label>
        </section>
        <section><ol id="frames"></ol></section>
      </body>
      ${createScript(sprite, panel)}
    </html>
  `;
}
