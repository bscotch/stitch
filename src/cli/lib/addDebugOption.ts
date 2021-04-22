import { CommanderStatic } from 'commander';
import { logDebug } from '../../lib/log';

export function addDebugOptions(cli: CommanderStatic) {
  return cli
    .option(
      '--debug',
      'Run in debug mode, which writes more logs to help triangulate bugs.',
    )
    .action(function (options) {
      if (options.debug) {
        process.env.DEBUG = 'true';
        logDebug('Running in debug mode.');
      }
    });
}
