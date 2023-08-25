import { pathy } from '@bscotch/pathy';
import vscode from 'vscode';
import { stitchEvents } from './events.mjs';
import { config } from './extension.config.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { logger } from './log.mjs';

interface ChangeEvent {
  type: 'change' | 'create' | 'delete';
  uri: vscode.Uri;
}

export class ChangeTracker {
  protected queue: ChangeEvent[] = [];
  protected timeout: NodeJS.Timeout | undefined;
  protected cache = {
    /**
     * If `true`, then the project has not been run since the last clean
     * (so the cache is already clean). Useful for deciding whether or not
     * to trigger a new cache-clean, e.g. upon change to an atlas file.
     */
    igorCacheIsClean: false,
  };

  constructor(readonly provider: StitchWorkspace) {
    stitchEvents.on(
      'clean-project-start',
      () => (this.cache.igorCacheIsClean = true),
    );
    stitchEvents.on(
      'run-project-start',
      () => (this.cache.igorCacheIsClean = false),
    );
  }

  addChange(event: ChangeEvent) {
    console.log('File change detected', event);
    this.queue.push(event);
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.flush(), config.externalChangeDelay);
  }

  protected async flush() {
    const queue = this.queue;
    this.queue = [];

    // Sort by yyp, then yy, then gml files.
    queue.sort((a, b) => {
      for (const ext of ['.yyp', '.yy', '.gml', '.atlas', '.png']) {
        const aExt = a.uri.path.endsWith(ext);
        const bExt = b.uri.path.endsWith(ext);
        if (aExt && !bExt) {
          return -1;
        }
        if (bExt && !aExt) {
          return 1;
        }
        if (aExt && bExt) {
          return 0;
        }
      }
      return 0;
    });

    for (const event of queue) {
      const { type, uri } = event;
      const project = this.provider.getProject(uri);
      if (!project) {
        logger.warn(`For change event ${type} ${uri.path}, no project found.`);
        continue;
      }

      // Change to the yyp file implies that we have deleted
      // or added an asset, so we need to respond to that.
      if (type === 'change' && uri.path.endsWith('.yyp')) {
        logger.info(`yyp file changed on disk. Reloading!`);
        await project.reloadYyp();
        continue;
      }

      // Creation/deletion of GML files must be accompanied
      // by a change to yy/yyp files, so we can ignore them.
      // They'll be incidentally handled by handling the yy/yyp changes.
      if (['create', 'delete'].includes(type) && uri.path.endsWith('.gml')) {
        continue;
      }
      // Changes to existing GML files can be handled immediately.
      if (type === 'change' && uri.path.endsWith('.gml')) {
        logger.info(`GML file "${uri.path}" changed on disk. Reloading!`);
        await this.provider.getGmlFile(uri)?.reload(undefined, {
          reloadDirty: true,
        });
        continue;
      }
      // Changes to yy files can be handled immediately.
      // For now we
      // only care about objects, since object yy files list
      // their events.
      if (type === 'change' && uri.path.endsWith('.yy')) {
        logger.info(`yy file "${uri.path}" changed on disk. Reloading!`);
        const asset = project.getAsset(pathy(uri.fsPath));
        if (!asset) {
          logger.warn(`No asset found for yy file "${uri.fsPath}".`);
        }
        await asset?.reload();
      }

      // Changes to art assets should be accumulated with timestamps
      // until the user runs the project. Depending on config settings,
      // changes to .atlas files should result in an auto-clean, and changes
      // to .png files should result in a popup detailing all sprites changes.
      if (type === 'change' && uri.path.endsWith('.atlas')) {
        const shouldClean =
          config.cleanOnSpineSpriteChange && !this.cache.igorCacheIsClean;
        logger.info(
          `atlas file "${uri.path}" changed on disk. `,
          shouldClean ? 'Cleaning!' : 'Skipping cache-clean.',
        );
        if (shouldClean) {
          void project.run({ clean: true });
          // Set the cache to clean so that we don't clean again while looping
          // through the queue.
          this.cache.igorCacheIsClean = true;
        }
        continue;
      }
      if (['change', 'create'].includes(type) && uri.path.endsWith('.png')) {
        // TODO: show/update a popup detailing all sprites that have changed.
      }
    }
  }
}
