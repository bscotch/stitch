import { oneline } from '@bscotch/utility';
import type { ArgumentConfig } from 'ts-command-line-args';
import type {
  StitchCliGlobalParams,
  StitchCliTargetParams,
} from './params.types.js';

const globalParamsGroup = 'General Options';

export const targetProjectParam: ArgumentConfig<{ targetProject?: string }> = {
  targetProject: {
    alias: 't',
    type: String,
    optional: true,
    defaultValue: process.cwd(),
    description: oneline`
      Path to the target GameMaker Studio 2 project.
      If not set, will auto-search the current directory.
    `,
    group: globalParamsGroup,
  },
};

export const targetParams: ArgumentConfig<StitchCliTargetParams> = {
  ...targetProjectParam,
  force: {
    alias: 'f',
    type: Boolean,
    optional: true,
    description: oneline`
      Bypass safety checks, including the normal requirement that the project be
      in a clean git state. Only use this option if you know what you're doing.
    `,
    group: globalParamsGroup,
  },
  readOnly: {
    type: Boolean,
    optional: true,
    description: oneline`
      Prevent any file-writes from occurring. Useful to prevent
      automatic fixes from being applied and for testing purposes.
      Commands may behave unexpectedly when this option is enabled.
    `,
    group: globalParamsGroup,
  },
};

export const watchParam: ArgumentConfig<{ watch?: boolean }> = {
  watch: {
    alias: 'w',
    type: Boolean,
    optional: true,
    description: oneline`
      Run the command with a watcher, so that it will re-run
      any time there is a change to the source files that might
      warrant a re-run.
    `,
    group: globalParamsGroup,
  },
};

export const globalParams: ArgumentConfig<StitchCliGlobalParams> = {
  help: {
    alias: 'h',
    type: Boolean,
    optional: true,
    group: globalParamsGroup,
  },
  debug: {
    alias: 'd',
    type: Boolean,
    optional: true,
    defaultValue: !!process.env.DEBUG,
    group: globalParamsGroup,
  },
};
