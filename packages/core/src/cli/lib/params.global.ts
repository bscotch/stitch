import { oneline } from '@bscotch/utility';
import { makeComposableBuilder } from 'cli-forge';

const globalParamsGroup = 'General Options';

export const withTargetProjectParam = makeComposableBuilder((args) =>
  args.option('targetProject', {
    alias: ['t'],
    type: 'string',
    default: {
      value: process.cwd(),
      description: 'Current directory',
    },
    description: oneline`
        Path to the target GameMaker Studio 2 project.
        If not set, will auto-search the current directory.
      `,
    group: globalParamsGroup,
  }),
);

export const withTargetParams = makeComposableBuilder((args) =>
  withTargetProjectParam(args)
    .option('force', {
      alias: ['f'],
      type: 'boolean',
      description: oneline`
        Bypass safety checks, including the normal requirement that the project be
        in a clean git state. Only use this option if you know what you're doing.
      `,
      group: globalParamsGroup,
    })
    .option('readOnly', {
      type: 'boolean',
      description: oneline`
        Prevent any file-writes from occurring. Useful to prevent
        automatic fixes from being applied and for testing purposes.
        Commands may behave unexpectedly when this option is enabled.
      `,
      group: globalParamsGroup,
    }),
);

export const withWatchParam = makeComposableBuilder((args) =>
  args.option('watch', {
    alias: ['w'],
    type: 'boolean',
    optional: true,
    description: oneline`
      Run the command with a watcher, so that it will re-run
      any time there is a change to the source files that might
      warrant a re-run.
    `,
    group: globalParamsGroup,
  }),
);

export const withGlobalParams = makeComposableBuilder((args) =>
  args
    .option('help', {
      alias: ['h'],
      type: 'boolean',
      description: 'Show help',
      group: globalParamsGroup,
    })
    .option('debug', {
      alias: ['d'],
      type: 'boolean',
      description: 'Run in debug mode',
      group: globalParamsGroup,
    }),
);
