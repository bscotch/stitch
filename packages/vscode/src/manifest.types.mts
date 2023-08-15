import { type CommandName } from './manifest.commands.mjs';
import type { ViewContainerId } from './manifest.views.mjs';

export const $showInPalette = Symbol('showInPalette');
export const $showInViewTitle = Symbol('showInViewTitle');
export const $showInViewItemContextMenu = Symbol('showInViewItemMenu');
export const $showInEditorContextMenu = Symbol('showInEditorContextMenu');

interface ManifestCommandMenuEntry {
  when: string;
  group: MenuItemGroup;
}

export interface ManifestCommand {
  command: string;
  title: string;
  shortTitle?: string;
  icon?: `$(${string})`;
  enablement?: string;
  [$showInPalette]?: boolean;
  [$showInViewTitle]?: ManifestCommandMenuEntry;
  [$showInViewItemContextMenu]?:
    | ManifestCommandMenuEntry
    | ManifestCommandMenuEntry[];
  [$showInEditorContextMenu]?: ManifestCommandMenuEntry;
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

export type MenuItemGroup = `${
  | 'navigation'
  | 'inline'
  | '1_stitch'
  | '7_modification'}@${number}`;

export interface MenuItem {
  command: CommandName;
  when: string;
  group: MenuItemGroup;
}

export interface ManifestMenus {
  'view/title': MenuItem[];
  'view/item/context': MenuItem[];
  'explorer/context': MenuItem[];
  'editor/context': MenuItem[];
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
