import { arrayWrapped, keysOf } from '@bscotch/utility';
import {
  $showInEditorContextMenu,
  $showInPalette,
  $showInViewItemContextMenu,
  $showInViewTitle,
  type ManifestCommand,
  type MenuItem,
} from './manifest.types.mjs';
import { when } from './manifest.when.mjs';

export const commands = {
  'stitch.diagnostics.suppress': {
    command: 'stitch.diagnostics.suppress',
    title: 'Suppress Diagnostics',
    [$showInViewItemContextMenu]: {
      when: when.viewItemIsFolder,
      group: '1_stitch@9',
    },
  },
  'stitch.openLocation.gameMaker': {
    command: 'stitch.openLocation.gameMaker',
    title: 'Stitch: Open GameMaker Location',
    [$showInPalette]: true,
  },
  'stitch.openLocation.saveDirectory': {
    command: 'stitch.openLocation.saveDirectory',
    title: 'Stitch: Open Save Directory',
    enablement: when.hasProjects,
    [$showInPalette]: true,
  },
  'stitch.openLocation.stitch': {
    command: 'stitch.openLocation.stitch',
    title: 'Stitch: Open Stitch Location',
    [$showInPalette]: true,
  },
  'stitch.setGameMakerVersion': {
    command: 'stitch.setGameMakerVersion',
    title: 'Stitch: Set GameMaker Version',
    enablement: when.hasProjects,
    [$showInPalette]: true,
  },
  'stitch.assets.rename': {
    command: 'stitch.assets.rename',
    title: 'Rename...',
    enablement: when.hasProjects,
    [$showInViewItemContextMenu]: {
      when: when.viewItemIsAsset,
      group: '7_modification@1',
    },
  },
  'stitch.assets.reveal': {
    command: 'stitch.assets.reveal',
    title: 'Stitch: Show Asset in Tree',
    enablement: `${when.hasProjects} && resourceExtname =~ /\\.(yy|gml)$/`,
    [$showInPalette]: true,
  },
  'stitch.assets.filters.enable': {
    command: 'stitch.assets.filters.enable',
    icon: '$(filter)',
    title: 'Enable Filter',
    [$showInViewItemContextMenu]: {
      when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsFilterDisabled}`,
      group: 'inline@1',
    },
  },
  'stitch.assets.filters.disable': {
    command: 'stitch.assets.filters.disable',
    icon: '$(filter-filled)',
    title: 'Disable Filter',
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
    [$showInViewItemContextMenu]: {
      when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsFilterGroup}`,
      group: 'inline@1',
    },
  },
  'stitch.assets.filters.delete': {
    command: 'stitch.assets.filters.delete',
    icon: '$(close)',
    title: 'Delete Filter',
    [$showInViewItemContextMenu]: {
      when: `${when.assetTreeFocusedAndHasProjects} && ${when.viewItemIsFilter}`,
      group: 'inline@2',
    },
  },
  'stitch.assets.renameFolder': {
    command: 'stitch.assets.renameFolder',
    title: 'Rename...',
    [$showInViewItemContextMenu]: {
      when: when.viewItemIsFolder,
      group: '7_modification@1',
    },
  },
  'stitch.assets.deleteFolder': {
    command: 'stitch.assets.deleteFolder',
    title: 'Delete',
    [$showInViewItemContextMenu]: {
      when: when.viewItemIsFolder,
      group: '7_modification@9',
    },
  },
  'stitch.assets.newFolder': {
    command: 'stitch.assets.newFolder',
    title: 'New Group...',
    icon: '$(new-folder)',
    [$showInViewTitle]: {
      when: when.assetTreeFocusedAndHasOneProject,
      group: 'navigation@1',
    },
    [$showInViewItemContextMenu]: [
      {
        when: when.viewItemIsFolder,
        group: 'navigation@3',
      },
      {
        when: when.isInlineProject,
        group: 'inline@1',
      },
    ],
  },
  'stitch.assets.editSprite': {
    command: 'stitch.assets.editSprite',
    title: 'Edit...',
    [$showInViewItemContextMenu]: {
      when: when.viewItemIsSprite,
      group: '7_modification@1',
    },
  },
  'stitch.assets.delete': {
    command: 'stitch.assets.delete',
    title: 'Delete',
    icon: '$(close)',
    [$showInViewItemContextMenu]: {
      when: when.viewItemIsAsset,
      group: '7_modification@9',
    },
  },
  'stitch.assets.newScript': {
    command: 'stitch.assets.newScript',
    title: 'New Script...',
    [$showInViewItemContextMenu]: {
      when: when.viewItemIsFolder,
      group: 'navigation@1',
    },
  },
  'stitch.assets.newObject': {
    command: 'stitch.assets.newObject',
    title: 'New Object...',
    [$showInViewItemContextMenu]: {
      when: when.viewItemIsFolder,
      group: 'navigation@2',
    },
  },
  'stitch.assets.setParent': {
    command: 'stitch.assets.setParent',
    title: 'Set Parent...',
    [$showInViewItemContextMenu]: {
      when: `(${when.assetTreeFocused} && ${when.viewItemIsObject}) || (${when.inspectorFocused} && ${when.viewItemIsInspectorParents})`,
      group: 'navigation@1',
    },
  },
  'stitch.assets.setSprite': {
    command: 'stitch.assets.setSprite',
    title: 'Set Sprite...',
    [$showInViewItemContextMenu]: {
      when: `(${when.assetTreeFocused} && ${when.viewItemIsObject}) || (${when.inspectorFocused} && ${when.viewItemIsInspectorSprite})`,
      group: 'navigation@1',
    },
  },
  'stitch.assets.newEvent': {
    command: 'stitch.assets.newEvent',
    title: 'New Event...',
    [$showInViewItemContextMenu]: {
      when: `(${when.assetTreeFocused} && ${when.viewItemIsObject}) || (${when.inspectorFocused} && ${when.viewItemIsInspectorEvents})`,
      group: 'navigation@1',
    },
  },
  'stitch.assets.deleteCode': {
    command: 'stitch.assets.deleteCode',
    title: 'Delete',
    [$showInViewItemContextMenu]: {
      when: `${when.viewItemIsCode} || ${when.viewItemIsInspectorEvents}`,
      group: '7_modification@9',
    },
  },
  'stitch.openIde': {
    command: 'stitch.openIde',
    title: 'Stitch: Open in GameMaker',
    shortTitle: 'Open in GameMaker',
    enablement: when.hasProjects,
    icon: '$(edit)',
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
  'stitch.run': {
    command: 'stitch.run',
    title: 'Stitch: Run Project',
    shortTitle: 'Run',
    icon: '$(play)',
    enablement: when.hasProjects,
    [$showInPalette]: true,
    [$showInViewTitle]: {
      when: when.assetTreeFocusedAndHasOneProject,
      group: 'navigation@5',
    },
    [$showInViewItemContextMenu]: {
      when: when.isInlineProject,
      group: 'inline@5',
    },
  },
  'stitch.run.noDefaults': {
    command: 'stitch.run.noDefaults',
    title: 'Stitch: Run Project (No Defaults)',
    shortTitle: 'RunExt',
    icon: '$(run-all)',
    enablement: when.hasProjects,
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
  'stitch.types.copy': {
    command: 'stitch.types.copy',
    title: 'Stitch: Copy Type',
    [$showInEditorContextMenu]: {
      when: when.resourceIsGml,
      group: '1_stitch@1',
    },
  },
  'stitch.types.copyAsJsdocType': {
    command: 'stitch.types.copyAsJsdocType',
    title: 'Stitch: Copy @type',
    [$showInEditorContextMenu]: {
      when: when.resourceIsGml,
      group: '1_stitch@2',
    },
  },
  'stitch.types.copyAsJsdocSelf': {
    command: 'stitch.types.copyAsJsdocSelf',
    title: 'Stitch: Copy @self',
    [$showInEditorContextMenu]: {
      when: when.resourceIsGml,
      group: '1_stitch@3',
    },
  },
  //#region Sprite Sources
  'stitch.spriteSource.create': {
    command: 'stitch.spriteSource.create',
    title: 'Add Sprite Source...',
    enablement: when.hasProjects,
    icon: '$(add)',
    [$showInViewTitle]: {
      when: when.spriteSourceTreeFocused,
      group: 'navigation@3',
    },
  },
  'stitch.spriteSource.import': {
    command: 'stitch.spriteSource.import',
    title: 'Import Changes',
    enablement: when.hasProjects,
    icon: '$(play)',
    [$showInViewTitle]: {
      when: when.spriteSourceTreeFocused,
      group: 'navigation@2',
    },
  },
  'stitch.spriteSource.edit': {
    command: 'stitch.spriteSource.edit',
    title: 'Edit Sources...',
    enablement: when.hasProjects,
    icon: '$(edit)',
    [$showInViewTitle]: {
      when: when.spriteSourceTreeFocused,
      group: 'navigation@1',
    },
  },
  'stitch.spriteSource.delete': {
    command: 'stitch.spriteSource.delete',
    title: 'Delete',
    enablement: when.hasProjects,
    icon: '$(close)',
    [$showInViewItemContextMenu]: {
      when: when.viewItemIsSpriteSource,
      group: '7_modification@9',
    },
  },
  'stitch.spriteSource.openExplorer': {
    command: 'stitch.spriteSource.openExplorer',
    title: 'Reveal in File Explorer',
    [$showInViewItemContextMenu]: {
      when: when.viewItemIsSpriteSource,
      group: 'navigation@9',
    },
  },
  //#endregion Sprite Sources
} satisfies Record<string, ManifestCommand>;
export const commandNames = keysOf(commands);
export type CommandName = keyof typeof commands;

export function canShowInPalette(commandName: CommandName): boolean {
  const command = commands[commandName] as ManifestCommand;
  if (!($showInPalette in command)) return false;
  return command[$showInPalette]!;
}

export function asEditorContextMenuEntry(
  commandName: CommandName,
): MenuItem | undefined {
  const command = commands[commandName] as ManifestCommand;
  if (!($showInEditorContextMenu in command)) return;
  return {
    command: commandName,
    when: command[$showInEditorContextMenu]!.when,
    group: command[$showInEditorContextMenu]!.group,
  };
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
