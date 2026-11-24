import type { GameMakerRelease } from '@bscotch/gamemaker-releases';
import type { StitchProject as GameMakerProject } from './extension.project.mjs';
import { html } from './lib.mjs';

const css = html`
  <style>
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    :root {
      --color-lts2026: #ff8652;
      --color-lts2022: #ffb38f;
      --color-monthly: #ae89ff;
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
    ol.reset,
    ul.reset {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    section.channels {
      display: flex;
      align-items: center;
      gap: 0.25em;
      margin-bottom: 1em;
    }
    section.channels > ol {
      display: flex;
      gap: 0.25em;
    }
    section.channels > ol > li {
      padding-inline: 0.5em;
      border-radius: 0.75em;
      color: black;
      font-weight: bold;
      font-size: 0.9em;
    }
    section.channels > ol > li[data-channel='lts2026'] {
      background-color: var(--color-lts2026);
    }
    section.channels > ol > li[data-channel='lts2022'] {
      background-color: var(--color-lts2022);
    }
    section.channels > ol > li[data-channel='monthly'] {
      background-color: var(--color-monthly);
    }
    section.channels > ol > li[data-channel='beta'] {
      background-color: var(--color-beta);
    }
    section.channels > ol > li[data-channel='unstable'] {
      background-color: var(--color-unstable);
    }
    ol.releases > li {
      margin-bottom: 1.5em;
    }
    [data-channel='lts2026']:where(.ide-version) {
      color: var(--color-lts2026);
    }
    [data-channel='lts2022']:where(.ide-version) {
      color: var(--color-lts2022);
    }
    [data-channel='monthly']:where(.ide-version) {
      color: var(--color-monthly);
    }
    [data-channel='beta']:where(.ide-version) {
      color: var(--color-beta);
    }
    [data-channel='unstable']:where(.ide-version) {
      color: var(--color-unstable);
    }
    .runtime-version,
    time {
      color: var(--color-text-muted);
    }
    summary > h4 {
      display: inline;
    }
    details > p,
    details > details {
      margin-left: 1em;
    }
    .change-group > summary {
      color: var(--color-text-muted);
    }
    section.used-by-projects {
      display: flex;
      gap: 0.25em;
    }
    section.used-by-projects > h4 {
      font-size: 1em;
    }
    section.used-by-projects > ol {
      display: flex;
      gap: 0.25em;
    }
    a.use-button {
      display: inline-block;
      user-select: none;
      border: 0.1em solid var(--color-text-muted);
      border-radius: 0.5em;
      color: var(--color-text-muted);
      padding-inline: 0.5em;
      margin-block: 0.25em;
    }
    a.use-button:hover {
      border-color: var(--color-text-muted);
      background-color: var(--color-text-muted);
      color: var(--color-background);
    }
  </style>
`;

const script = html`
  <script>
    const vscode = acquireVsCodeApi();
  </script>
`;

function compileRelease(
  release: GameMakerRelease,
  projects: GameMakerProject[],
) {
  const releaseDate = new Date(release.publishedAt).toLocaleDateString();
  const releaseDateIso = new Date(release.publishedAt).toISOString();
  // Color-code by the most stable channel
  const channel = release.channels[0];

  const projectsUsingThisVersion = projects.filter(
    (project) => project.ideVersion === release.version,
  );
  const usedByProjects = projectsUsingThisVersion.map(
    (project) => html`<li class="used-by-project">${project.name}</li>`,
  );
  const usedBy = usedByProjects.length
    ? html`<section aria-label="Used by projects" class="used-by-projects">
        <h4>Used By:</h4>
        <ul class="reset">
          ${usedByProjects}
        </ul>
      </section>`
    : '';

  // Need a "use" button if there are any projects that don't use this version.
  const useButton = projects.some((p) => p.ideVersion !== release.version)
    ? html`<a
        role="button"
        class="use-button"
        onclick="vscode.postMessage({type: 'setVersion', version: '${release.version}'})"
      >
        Use this version
      </a>`
    : '';

  return html`
    <article class="release ${channel}">
      <header>
        <h2 class="ide-version" data-channel="${channel}">
          ${projectsUsingThisVersion.length ? '🌟' : ''} ${release.version}
          (IDE)
        </h2>
        <h3 class="runtime-version" data-channel="${channel}">
          ${release.runtime.version} (Runtime)
        </h3>
        <time datetime="${releaseDateIso}"> ${releaseDate} </time>
      </header>
      ${usedBy} ${useButton}
    </article>
  `;
}

export function compile(
  releases: GameMakerRelease[],
  projects: GameMakerProject[],
  channels: string[],
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
        <h1>GameMaker Version Picker</h1>
        <p>
          <i>
            Compiled from GameMaker's release feeds. Runtime pairings are
            inferred, so they may occasionally be wrong.
          </i>
        </p>
        <section class="channels">
          <a
            role="button"
            aria-label="Open the configuration settings for GameMaker Release Channels"
            title="Change release channels"
            onclick="vscode.postMessage({type: 'openChannelsSetting'})"
          >
            ⚙️
          </a>
          <ol
            class="reset"
            aria-label="GameMaker Release channels (specified in preferences) and their color-coding in this view."
          >
            ${channels.map(
              (channel) => html`<li data-channel="${channel}">${channel}</li>`,
            )}
          </ol>
        </section>
        <ol class="releases reset">
          ${releases.map(
            (release) => html`<li>${compileRelease(release, projects)}</li>`,
          )}
        </ol>
      </body>
      ${script}
    </html>
  `;
}
