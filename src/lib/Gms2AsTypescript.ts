/**
 * Create a "mirror" of a GMS2 project, which has metadata, reports,
 * etc with sourcemaps leading back to the original code.
 *
 * **⚠ This is experimental! **
 */

import Gms2Project, { Gms2ResourceChangeListener } from 'root/index.js';
import type { Gms2ResourceSubclass } from './components/Gms2ResourceArray.js';
import { StitchError } from './errors.js';
import type { Gms2ProjectOptions } from './Gms2Project.js';

type Gms2AsTypescriptOptions = Pick<Gms2ProjectOptions, 'projectPath'>;

export class Gms2AsTypescript {
  readonly project: Gms2Project;

  constructor(options?: Gms2AsTypescriptOptions) {
    const listener = this.on.bind(this);
    this.project = new Gms2Project({
      ...options,
      listener,
    });
  }

  /**
   * Event router, which should be attached to a project instance.
   *
   * @type {Gms2ResourceChangeListener}
   */
  on(...args: Parameters<Gms2ResourceChangeListener>) {
    const [change, resource] = args;
    switch (change) {
      case 'create':
        this.onCreated(resource);
        break;
      default:
        throw new StitchError(`Unhandled resource change: ${change}`);
    }
  }

  onCreated(resource: Gms2ResourceSubclass) {
    console.log(`Created ${resource.type}: ${resource.name}`);
  }
}
