#!/usr/bin/env node
import { undent } from '@bscotch/utility';
import { cli, chain } from 'cli-forge';
import { addDebugOptions } from './lib/addDebugOption.js';
import options from './lib/cli-options.js';
import version from './lib/version.js';

export const versionCommand = cli('version', {
  description: undent`
  Set the project version in all options files.
  (Note that the PS4 and Switch options files do not include the version
  and must be set outside of GameMaker).`,
  builder: (cli) =>
    chain(cli, options.targetProject, options.force, addDebugOptions).option(
      'projectVersion',
      {
        type: 'string',
        description: undent`
    Can use one of:
      + "0.0.0.0" syntax (exactly as GameMaker stores versions)
      + "0.0.0" syntax (semver without prereleases -- the 4th value will always be 0)
      + "0.0.0-rc.0" syntax (the 4th number will be the RC number)
      The four numbers will appear in all cases as the string "major.minor.patch.candidate"
  `,
      },
    ),
  handler: async (opts) => {
    await version(opts);
  },
});
