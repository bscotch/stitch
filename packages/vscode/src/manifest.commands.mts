import { arrayWrapped, keysOf } from '@bscotch/utility';
import {
  $showInPalette,
  $showInViewItemContextMenu,
  $showInViewTitle,
  type ManifestCommand,
  type MenuItem,
} from './manifest.types.mjs';
import { when } from './manifest.when.mjs';

export const commands = {
  'stitch.assets.reveal': {
    command: 'stitch.assets.reveal',
    title: 'Stitch: Show Asset',
    enablement: `${when.hasProjects} && resourceExtname =~ /\\.(yy|gml)$/`,
    [$showInPalette]: true,
  },
  'stitch.assets.filters.enable': {
    command: 'stitch.assets.filters.enable',
    icon: '$(filter)',
    title: 'Enable Filter',
    enablement: when.assetTreeFocusedAndHasProjects,
    [$showInViewItemContextMenu]: {
      when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsFilterDisabled}`,
      group: 'inline@1',
    },
  },
  'stitch.assets.filters.disable': {
    command: 'stitch.assets.filters.disable',
    icon: '$(filter-filled)',
    title: 'Disable Filter',
    enablement: when.assetTreeFocusedAndHasProjects,
    [$showInViewItemContextMenu]: {
      when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsFilterEnabled}`,
      group: 'inline@1',
    },
  },
  'stitch.assets.filters.edit': {
    command: 'stitch.assets.filters.edit',
    title: 'Edit Filter',
  },
  'stitch.assets.filters.new': {
    command: 'stitch.assets.filters.new',
    icon: '$(add)',
    title: 'New Filter...',
    enablement: when.assetTreeFocusedAndHasProjects,
    [$showInViewItemContextMenu]: {
      when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsFilterGroup}`,
      group: 'inline@1',
    },
  },
  'stitch.assets.filters.delete': {
    command: 'stitch.assets.filters.delete',
    icon: '$(close)',
    title: 'Delete Filter',
    enablement: when.assetTreeFocusedAndHasProjects,
    [$showInViewItemContextMenu]: {
      when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsFilter}`,
      group: 'inline@2',
    },
  },
  'stitch.assets.newFolder': {
    command: 'stitch.assets.newFolder',
    title: 'New Group...',
    icon: '$(new-folder)',
    enablement: when.assetTreeFocusedAndHasProjects,
    [$showInViewTitle]: {
      when: when.assetTreeFocusedAndHasOneProject,
      group: 'navigation@1',
    },
    [$showInViewItemContextMenu]: [
      {
        when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsFolder}`,
        group: 'navigation@3',
      },
      {
        when: when.isInlineProject,
        group: 'inline@1',
      },
    ],
  },
  'stitch.assets.newScript': {
    command: 'stitch.assets.newScript',
    title: 'New Script...',
    enablement: when.assetTreeFocusedAndHasProjects,
    [$showInViewItemContextMenu]: {
      when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsFolder}`,
      group: 'navigation@1',
    },
  },
  'stitch.assets.newObject': {
    command: 'stitch.assets.newObject',
    title: 'New Object...',
    enablement: when.assetTreeFocusedAndHasProjects,
    [$showInViewItemContextMenu]: {
      when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsFolder}`,
      group: 'navigation@2',
    },
  },
  'stitch.assets.newEvent': {
    command: 'stitch.assets.newEvent',
    title: 'New Event...',
    enablement: when.assetTreeFocusedAndHasProjects,
    [$showInViewItemContextMenu]: {
      when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsObject}`,
      group: 'navigation@1',
    },
  },
  'stitch.openIde': {
    command: 'stitch.openIde',
    title: 'Stitch: Open in GameMaker',
    shortTitle: 'Open in GameMaker',
    enablement: `(resourceExtname =~ /\\.(yy|yyp|gml)$/) || (${when.assetTreeFocused} && ${when.hasProjects})`,
    icon: '$(edit)',
    [$showInPalette]: true,
    [$showInViewTitle]: {
      when: when.assetTreeFocusedAndHasOneProject,
      group: 'navigation@2',
    },
    [$showInViewItemContextMenu]: {
      when: when.isInlineProject,
      group: 'inline@2',
    },
  },
  'stitch.run': {
    command: 'stitch.run',
    title: 'Stitch: Run Project',
    shortTitle: 'Run',
    icon: '$(play)',
    [$showInPalette]: true,
    [$showInViewTitle]: {
      when: when.assetTreeFocusedAndHasOneProject,
      group: 'navigation@4',
    },
    [$showInViewItemContextMenu]: {
      when: when.isInlineProject,
      group: 'inline@4',
    },
  },
  'stitch.clean': {
    command: 'stitch.clean',
    title: 'Stitch: Clean Project Cache',
    shortTitle: 'Clean Cache',
    icon: '$(history)',
    [$showInPalette]: true,
    [$showInViewTitle]: {
      when: when.assetTreeFocusedAndHasOneProject,
      group: 'navigation@3',
    },
    [$showInViewItemContextMenu]: {
      when: when.isInlineProject,
      group: 'inline@3',
    },
  },
  'stitch.refresh': {
    command: 'stitch.refresh',
    title: 'Stitch: Refresh Project',
    shortTitle: 'Refresh Project',
    icon: '$(refresh)',
    [$showInPalette]: true,
  },
} satisfies Record<string, ManifestCommand>;
export const commandNames = keysOf(commands);
export type CommandName = keyof typeof commands;

export function canShowInPalette(commandName: CommandName): boolean {
  const command = commands[commandName] as ManifestCommand;
  if (!($showInPalette in command)) return false;
  return command[$showInPalette]!;
}

export function asViewTitleEntry(
  commandName: CommandName,
): MenuItem | undefined {
  const command = commands[commandName] as ManifestCommand;
  if (!($showInViewTitle in command)) return;
  return {
    command: commandName,
    when: command[$showInViewTitle]!.when,
    group: command[$showInViewTitle]!.group,
  };
}

export function asViewItemContextMenuEntry(
  commandName: CommandName,
): MenuItem[] | undefined {
  const command = commands[commandName];
  if (!($showInViewItemContextMenu in command)) return;
  const entries = arrayWrapped(command[$showInViewItemContextMenu]);
  return entries.map((entry) => ({
    command: commandName,
    when: entry.when,
    group: entry.group,
  }));
}
