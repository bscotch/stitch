import { camelCase } from 'change-case';
import {
  YyRoom,
  YyRoomInstance,
  YyRoomInstanceLayer,
  yyRoomInstanceDefaults,
} from '../../../types/YyRoom';
import { assert } from '../../errors';
import { info } from '../../log';
import { NumberFixed } from '../../NumberFixed';
import { uuidV4 } from '../../uuid';
import type { Gms2Object } from './Gms2Object';
import {
  Gms2ResourceBase,
  Gms2ResourceBaseParameters,
} from './Gms2ResourceBase';

export class Gms2Room extends Gms2ResourceBase {
  protected yyData!: YyRoom; // Happens in the super() constructor

  constructor(...setup: Gms2ResourceBaseParameters) {
    super('rooms', ...setup);
  }

  get instanceLayers() {
    const layers = this.yyData.layers;
    const instanceLayers: YyRoomInstanceLayer[] = [];
    for (const layer of layers) {
      if ('instances' in layer) {
        instanceLayers.push(layer);
      }
    }
    return instanceLayers;
  }

  addObjectInstance(object: Gms2Object, x: number, y: number) {
    const instanceLayer = this.instanceLayers[0];
    assert(instanceLayer, `No instance layer found in room ${this.name}`);

    // Add to the list of instances in the instance layer
    const instanceName = camelCase(uuidV4()); // Need a unique identifier;
    const newInstance: YyRoomInstance = {
      ...yyRoomInstanceDefaults,
      name: instanceName,
      x: new NumberFixed(x),
      y: new NumberFixed(y),
      objectId: {
        name: object.name,
        path: `objects/${object.name}/${object.name}.yy` as const,
      },
    };
    instanceLayer.instances.push(newInstance);

    // Add to the instancing order
    this.yyData.instanceCreationOrder.push({
      name: instanceName,
      path: `rooms/${this.name}/${this.name}.yy` as const,
    });
    info(`Added object ${object.name} instance to room ${this.name}`);
    return this.save();
  }
}
