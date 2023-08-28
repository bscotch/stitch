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
    }
    #frames img {
      max-width: 15em;
      position: relative;
    }
    .dot {
      background-color: red;
      position: absolute;
    }
  </style>
`;

function createScript(sprite: Asset<'sprites'>, panel: vscode.WebviewPanel) {
  const frameUris = sprite.framePaths.map((p) =>
    panel.webview.asWebviewUri(vscode.Uri.file(p.absolute)),
  );
  const { xorigin, yorigin } = sprite.yy.sequence;
  const frameUrisArrayString = `[${frameUris
    .map((u) => `"${u.toString()}"`)
    .join(',')}]`;
  return html`
    <script>
      const vscode = acquireVsCodeApi();
      const imagePaths = ${frameUrisArrayString};
      const size = {
        naturalWidth: 0,
        naturalHeight: 0,
        width: 0,
        height: 0,
        xorigin: ${xorigin},
        yorigin: ${yorigin},
      };
      class FrameImage {
        constructor(uri) {
          this.uri = uri;
          this.image = new Image();

          this.dot = document.createElement('div');
          this.dot.classList.add('dot');

          this.container = document.createElement('li');
          this.container.appendChild(this.image);
          this.container.appendChild(this.dot);

          document.getElementById('frames').appendChild(this.container);
        }

        load() {
          this.image.src = this.uri;
        }

        moveDot(x, y, scalar) {
          this.dot.style.left = x + 'px';
          this.dot.style.top = y + 'px';
          this.dot.style.width = scalar + 'px';
          this.dot.style.height = scalar + 'px';
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

          // Add click handler that will update the origin after normalizing the click position
          frame.image.addEventListener('click', (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const scalar = size.width / size.naturalWidth;
            for (const f of frames) {
              f.moveDot(x, y, scalar);
            }
            const xnorm = Math.floor((x / size.width) * size.naturalWidth);
            const ynorm = Math.floor((y / size.height) * size.naturalHeight);
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
        <section><ol id="frames"></ol></section>
      </body>
      ${createScript(sprite, panel)}
    </html>
  `;
}
