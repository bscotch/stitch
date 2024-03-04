import { pathy } from '@bscotch/pathy';
import { keysOf } from '@bscotch/utility';
import {
  asEditorContextMenuEntry,
  asViewItemContextMenuEntry,
  asViewTitleEntry,
  canShowInPalette,
  commands,
} from './manifest.commands.mjs';
import { Manifest, MenuItem } from './manifest.types.mjs';

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

  // Update Activity Bar view
  manifest.contributes.viewsContainers.activitybar = [
    {
      id: 'bscotch-stitch',
      title: 'Stitch',
      icon: './images/stitch-logo-mono.svg',
    },
  ];
  manifest.contributes.views['bscotch-stitch'] = [
    {
      id: 'bscotch-stitch-inspector',
      name: 'Inspector',
      icon: './images/stitch-logo-mono.svg',
      type: 'tree',
      contextualTitle: 'Stitch:Inspector',
    },
    {
      id: 'bscotch-stitch-files',
      name: 'Included Files',
      icon: './images/stitch-logo-mono.svg',
      type: 'tree',
      contextualTitle: 'Stitch:Files',
    },
    {
      id: 'bscotch-stitch-resources',
      name: 'Resources',
      icon: './images/stitch-logo-mono.svg',
      type: 'tree',
      contextualTitle: 'Stitch:Resources',
    },
    {
      id: 'bscotch-stitch-igor',
      name: 'Runner',
      icon: './images/stitch-logo-mono.svg',
      type: 'webview',
      contextualTitle: 'Stitch:Runner',
    },
    {
      id: 'bscotch-stitch-sprite-sources',
      name: 'Sprite Sources',
      icon: './images/stitch-logo-mono.svg',
      type: 'tree',
      contextualTitle: 'Stitch:SpriteSources',
    },
  ];

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
  manifest.contributes.menus['editor/context'] = commandNames
    .filter(asEditorContextMenuEntry)
    .map(asEditorContextMenuEntry)
    .flat() as MenuItem[];

  // Write out the updated manifest
  await manifestPath.write(manifest);
}

main();
