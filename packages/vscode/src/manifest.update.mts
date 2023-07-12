import { pathy } from '@bscotch/pathy';
import { keysOf } from '@bscotch/utility';
import {
  asViewItemContextMenuEntry,
  asViewTitleEntry,
  canShowInPalette,
  commands,
} from './manifest.commands.mjs';
import { Manifest, MenuItem } from './manifest.types.mjs';
import { viewsArray, viewsContainersArray } from './manifest.views.mjs';

async function main() {
  const manifestPath = pathy('package.json');
  await manifestPath.exists({ assert: true });

  const manifest = await manifestPath.read<Manifest>();
  const commandNames = keysOf(commands);

  // Update commands
  manifest.contributes.commands = [];
  for (const command of keysOf(commands)) {
    manifest.contributes.commands.push(commands[command]);
  }

  // Update views
  manifest.contributes.views['bscotch-stitch'] = viewsArray;
  manifest.contributes.viewsContainers.activitybar = viewsContainersArray;

  // Update menus
  manifest.contributes.menus['commandPalette'] = commandNames
    .filter(canShowInPalette)
    .map((c) => ({ command: c }));
  manifest.contributes.menus['view/title'] = commandNames
    .filter(asViewTitleEntry)
    .map(asViewTitleEntry) as MenuItem[];
  manifest.contributes.menus['view/item/context'] = commandNames
    .filter(asViewItemContextMenuEntry)
    .map(asViewItemContextMenuEntry)
    .flat() as MenuItem[];

  // Write out the updated manifest
  await manifestPath.write(manifest);
}

main();
