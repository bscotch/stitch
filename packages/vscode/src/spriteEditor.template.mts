import type { Asset } from '@bscotch/gml-parser';
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
  </style>
`;

const script = html`
  <script>
    const vscode = acquireVsCodeApi();
  </script>
`;

export function compile(sprite: Asset<'sprites'>) {
  return html`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      ${css}
      <body></body>
      ${script}
    </html>
  `;
}
