import type { GameMakerReleaseWithNotes } from '@bscotch/gamemaker-releases';
import type { GameMakerProject } from './extension.project.mjs';
import { html } from './lib.mjs';

const css = html`
  <style>
    body {
      /* font-family: var(--vscode-editor-font-family); */
      font-weight: var(--vscode-editor-font-weight);
      font-size: var(--vscode-editor-font-size);
      color: var(--vscode-editor-foreground);
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
    ol.reset,
    ul.reset {
      list-style: none;
      padding: 0;
    }
    ol.releases > li {
      margin-bottom: 1.5em;
    }
    .use-version-toggle {
      display: inline-flex;
      align-items: center;
      flex-direction: row;
      gap: 0.25em;
      padding-right: 0.25em;
    }
    ul.use-version-toggles {
      margin: 0.25em 0;
    }
    ul.use-version-toggles > li {
      display: inline-flex;
      align-items: stretch;
      flex-direction: row;
      border: 0.1em solid var(--vscode-editor-foreground);
      border-radius: 0.5em;
      gap: 0.5em;
    }
  </style>
`;

const script = html`
  <script>
    const vscode = acquireVsCodeApi();
  </script>
`;

function compileRelease(
  release: GameMakerReleaseWithNotes,
  projects: GameMakerProject[],
) {
  const releaseDate = new Date(release.ide.publishedAt).toLocaleDateString();
  const releaseDateIso = new Date(release.ide.publishedAt).toISOString();

  const projectsUsingThisVersion = projects.filter(
    (project) => project.ideVersion === release.ide.version,
  );
  const projectToggles = projects.map((project) => {
    return html`<li><label class="use-version-toggle">
      <input
        type="checkbox"
        ${project.ideVersion === release.ide.version ? 'checked' : ''}
        onChange="vscode.postMessage({type: 'toggleVersion', version: '${
          release.ide.version
        }', project: '${project.name}'})"
      />
      <span>${project.name}</span>
    </li></label>`;
  });

  return html`
    <article class="release ${release.channel}">
      <header>
        <h2>
          ${projectsUsingThisVersion.length ? '🌟' : ''} ${release.ide.version}
          (IDE)
        </h2>
        <h3>${release.runtime.version} (Runtime)</h3>
        <time datetime="${releaseDateIso}"> ${releaseDate} </time>
      </header>
      <ul class="use-version-toggles reset">
        ${projectToggles}
      </ul>
      ${release.summary
        ? html`<section>
            <details>
              <summary>Summary</summary>
              ${release.summary}
            </details>
          </section>`
        : ''}
    </article>
  `;
}

export function compile(
  releases: GameMakerReleaseWithNotes[],
  projects: GameMakerProject[],
) {
  return html`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      ${css}
      <body>
        <body>
          <h1>GameMaker Version Picker</h1>
          <p>
            <i>
              These release notes are automatically compiled from the public
              GameMaker release notes. They may be incomplete or contain errors.
            </i>
          </p>
          <ol class="releases reset">
            ${releases.map(
              (release) => html`<li>${compileRelease(release, projects)}</li>`,
            )}
          </ol>
        </body>
      </body>
      ${script}
    </html>
  `;
}
