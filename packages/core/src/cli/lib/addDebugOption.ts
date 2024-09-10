import { debug } from '../../utility/log.js';
import { makeComposableBuilder } from 'cli-forge';

export const addDebugOptions = makeComposableBuilder((cli) =>
  cli
    .option('debug', {
      type: 'boolean',
      description:
        'Run in debug mode, which writes more logs to help triangulate bugs.',
    })
    .middleware((args) => {
      if (args.debug) {
        process.env.DEBUG = 'true';
        debug('Running in debug mode');
      }
    }),
);
