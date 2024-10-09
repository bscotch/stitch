import { oneline } from '@bscotch/utility';
import { makeComposableBuilder } from 'cli-forge';

export const force = makeComposableBuilder((argv) =>
  argv.option('force', {
    type: 'boolean',
    alias: ['f'],
    description: oneline`
      Bypass safety checks, including the normal requirement that the project be
      in a clean git state. Only use this option if you know what you're doing.
    `,
  }),
);
export const targetProject = makeComposableBuilder((argv) =>
  argv.option('targetProject', {
    type: 'string',
    alias: ['t'],
    description: oneline`
      Path to the target GameMaker Studio 2 project.
      If not set, will auto-search the current directory.
    `,
  }),
);
export const watch = makeComposableBuilder((argv) =>
  argv.option('watch', {
    type: 'boolean',
    alias: ['w'],
    description: oneline`
      Run the command with a watcher, so that it will re-run
      any time there is a change to the source files that might
      warrant a re-run.
    `,
  }),
);

export default {
  force,
  targetProject,
  watch,
};
