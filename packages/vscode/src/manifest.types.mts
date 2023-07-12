import type { ViewContainerId } from './manifest.views.mjs';

export interface ManifestCommand {
  command: string;
  title: string;
  shortTitle?: string;
  icon?: `$(${string})`;
  enablement?: string;
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

export interface Manifest {
  contributes: {
    commands: ManifestCommand[];
    views: Record<ViewContainerId, ManifestView[]>;
    viewsContainers: {
      activitybar: ManifestViewContainer[];
    };
  };
}
