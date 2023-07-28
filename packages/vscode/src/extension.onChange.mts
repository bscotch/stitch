import { pathy } from '@bscotch/pathy';
import vscode from 'vscode';
import { config } from './extension.config.mjs';
import type { StitchProvider } from './extension.provider.mjs';
import { logger } from './log.mjs';

interface ChangeEvent {
  type: 'change' | 'create' | 'delete';
  uri: vscode.Uri;
}

export class ChangeTracker {
  protected queue: ChangeEvent[] = [];
  protected timeout: NodeJS.Timeout | undefined;

  constructor(readonly provider: StitchProvider) {}

  addChange(event: ChangeEvent) {
    this.queue.push(event);
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.flush(), config.externalChangeDelay);
  }

  protected async flush() {
    const queue = this.queue;
    this.queue = [];

    // Sort by yyp, then yy, then gml files.
    queue.sort((a, b) => {
      for (const ext of ['.yyp', '.yy', '.gml']) {
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
    }
  }
}
