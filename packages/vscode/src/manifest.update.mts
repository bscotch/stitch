import { pathy } from '@bscotch/pathy';
import { keysOf } from '@bscotch/utility';
import { commands } from './manifest.commands.mjs';
import type { Manifest } from './manifest.types.mjs';
import { viewsArray, viewsContainersArray } from './manifest.views.mjs';

async function main() {
  const manifestPath = pathy('package.json');
  await manifestPath.exists({ assert: true });

  const manifest = await manifestPath.read<Manifest>();

  // Update commands
  manifest.contributes.commands = [];
  for (const command of keysOf(commands)) {
    manifest.contributes.commands.push(commands[command]);
  }

  // Update views
  manifest.contributes.views['bscotch-stitch'] = viewsArray;
  manifest.contributes.viewsContainers.activitybar = viewsContainersArray;

  // Write out the updated manifest
  await manifestPath.write(manifest);
}

main();
