import type { ViewContainerId } from './manifest.views.mjs';

export const $showInPalette = Symbol('showInPalette');

export interface ManifestCommand {
  command: string;
  title: string;
  shortTitle?: string;
  icon?: `$(${string})`;
  enablement?: string;
  [$showInPalette]?: boolean;
}

export interface ManifestView {
  id: string;
  name: string;
  icon: './images/stitch-logo-mono.svg';
  type: 'tree';
}

export interface ManifestViewContainer {
  id: string;
  title: string;
  icon: './images/stitch-logo-mono.svg';
}

export interface ManifestMenus {
  'view/title': unknown;
  'view/item/context': unknown;
  'explorer/context': unknown;
  commandPalette: ManifestCommandPalette[];
}

export interface ManifestCommandPalette {
  command: string;
}

export interface Manifest {
  contributes: {
    commands: ManifestCommand[];
    views: Record<ViewContainerId, ManifestView[]>;
    viewsContainers: {
      activitybar: ManifestViewContainer[];
    };
    menus: ManifestMenus;
  };
}
