import type { ManifestCommand } from './manifest.types.mjs';
import { when } from './manifest.when.mjs';

export const commands = {
  'stitch.assets.reveal': {
    command: 'stitch.assets.reveal',
    title: 'Stitch: Show Asset',
    enablement: `${when.hasProjects} && resourceExtname =~ /\\.(yy|gml)$/`,
  },
  'stitch.assets.filters.enable': {
    command: 'stitch.assets.filters.enable',
    icon: '$(filter)',
    title: 'Enable Filter',
    enablement: `${when.assetTreeFocused} && ${when.hasProjects}`,
  },
  'stitch.assets.filters.disable': {
    command: 'stitch.assets.filters.disable',
    icon: '$(filter-filled)',
    title: 'Disable Filter',
    enablement: `${when.assetTreeFocused} && ${when.hasProjects}`,
  },
  'stitch.assets.filters.edit': {
    command: 'stitch.assets.filters.edit',
    title: 'Edit Filter',
  },
  'stitch.assets.filters.new': {
    command: 'stitch.assets.filters.new',
    icon: '$(add)',
    title: 'New Filter...',
    enablement: `${when.assetTreeFocused} && ${when.hasProjects}`,
  },
  'stitch.assets.filters.delete': {
    command: 'stitch.assets.filters.delete',
    icon: '$(close)',
    title: 'Delete Filter',
    enablement: `${when.assetTreeFocused} && ${when.hasProjects}`,
  },
  'stitch.assets.newFolder': {
    command: 'stitch.assets.newFolder',
    title: 'New Group...',
    icon: '$(new-folder)',
    enablement: `${when.assetTreeFocused} && ${when.hasProjects}`,
  },
  'stitch.assets.newScript': {
    command: 'stitch.assets.newScript',
    title: 'New Script...',
    enablement: `${when.assetTreeFocused} && ${when.hasProjects}`,
  },
  'stitch.assets.newObject': {
    command: 'stitch.assets.newObject',
    title: 'New Object...',
    enablement: `${when.assetTreeFocused} && ${when.hasProjects}`,
  },
  'stitch.openIde': {
    command: 'stitch.openIde',
    title: 'Stitch: Open in GameMaker',
    shortTitle: 'Open in GameMaker',
    enablement: `(resourceExtname =~ /\\.(yy|yyp|gml)$/) || (${when.assetTreeFocused} && ${when.hasProjects})`,
    icon: '$(edit)',
  },
  'stitch.run': {
    command: 'stitch.run',
    title: 'Stitch: Run Project',
    shortTitle: 'Run',
    icon: '$(play)',
  },
  'stitch.clean': {
    command: 'stitch.clean',
    title: 'Stitch: Clean Project Cache',
    shortTitle: 'Clean Cache',
    icon: '$(history)',
  },
  'stitch.refresh': {
    command: 'stitch.refresh',
    title: 'Stitch: Refresh Project',
    shortTitle: 'Refresh Project',
    icon: '$(refresh)',
  },
} satisfies Record<string, ManifestCommand>;
