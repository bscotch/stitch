import { exec } from '@bscotch/utility';
import { expect } from 'chai';
import { root } from './lib/util.js';

describe('Stitch CLI execution', function () {
  it('can execute all compiled CLI commands with --help', async function () {
    // Discover all commands
    const cliScripts = (await root.join('dist/cli').listChildren()).filter(
      (x) =>
        x.basename.endsWith('.js') &&
        x.basename.startsWith('stitch') &&
        // Stitch issues uses interactive prompts, so SKIP
        !x.basename.startsWith('stitch-issues'),
    );

    // Run all with `--help`, expecting 0-exit
    const runWaits: Promise<void>[] = [];
    const incompleteCommands: Set<string> = new Set();
    const successfulCommands: Set<string> = new Set();
    const failedCommands: Set<string> = new Set();
    for (const cliScript of cliScripts) {
      for (const flag of ['--help', '-h']) {
        const cmdString = `${cliScript.name} ${flag}`;
        incompleteCommands.add(cmdString);
        runWaits.push(
          exec('node', [cliScript.absolute, flag])
            .then((x) => {
              if (x.code) {
                console.error(cmdString, x.stderr);
                failedCommands.add(cmdString);
              } else {
                successfulCommands.add(cmdString);
              }
            })
            .catch((err) => {
              console.error(cmdString, err);
              failedCommands.add(cmdString);
            })
            .finally(() => {
              incompleteCommands.delete(cmdString);
            }),
        );
      }
    }
    await Promise.allSettled(runWaits);
    expect(
      failedCommands.size,
      `Commands failed: ${[...failedCommands].join(', ')}`,
    ).to.equal(0);
  });
});
