import {
  YyRoom,
  YyRoomInstance,
  YyRoomInstanceLayer,
  yyRoomInstanceSchema,
} from '@bscotch/yy';
import { camelCase } from 'change-case';
import { assert } from '../../../utility/errors.js';
import { info } from '../../../utility/log.js';
import { uuidV4 } from '../../../utility/uuid.js';
import { StitchProjectComms } from '../../StitchProject.types.js';
import type { Gms2Object } from './Gms2Object.js';
import {
  Gms2ResourceBase,
  Gms2ResourceBaseParameters,
} from './Gms2ResourceBase.js';

export class Gms2Room extends Gms2ResourceBase<YyRoom> {
  constructor(...setup: Gms2ResourceBaseParameters) {
    super('rooms', ...setup);
  }

  get instanceLayers() {
    const layers = this.yyData.layers;
    const instanceLayers: YyRoomInstanceLayer[] = [];
    for (const layer of layers) {
      if ('instances' in layer) {
        instanceLayers.push(layer as any);
      }
    }
    return instanceLayers;
  }

  hasObjectInstance(object: Gms2Object | string) {
    const targetName = typeof object === 'string' ? object : object.name;
    for (const instanceLayer of this.instanceLayers || []) {
      for (const instance of instanceLayer.instances) {
        if (instance.objectId.name === targetName) {
          return true;
        }
      }
    }
    return false;
  }

  addObjectInstance(object: Gms2Object, x = 0, y = 0) {
    const instanceLayer = this.instanceLayers[0];
    assert(instanceLayer, `No instance layer found in room ${this.name}`);

    // Add to the list of instances in the instance layer
    const instanceName = camelCase(uuidV4()); // Need a unique identifier;
    const newInstance: YyRoomInstance = yyRoomInstanceSchema.parse({
      name: instanceName,
      x,
      y,
      objectId: object.id,
    });
    instanceLayer.instances.push(newInstance);

    // Add to the instancing order
    this.yyData.instanceCreationOrder.push({
      name: instanceName,
      path: `rooms/${this.name}/${this.name}.yy` as const,
    });
    info(`Added object ${object.name} instance to room ${this.name}`);
    return this.save();
  }

  static async create(name: string, comms: StitchProjectComms) {
    const room = new Gms2Room(name, comms);
    await room.replaceYyFile({
      name,
      layers: [
        {
          resourceType: 'GMRBackgroundLayer',
        },
        {
          resourceType: 'GMRInstanceLayer',
        },
      ],
      // Rooms start with 8 views
      views: Array.from({ length: 8 }).map(() => ({})),
    } as YyRoom);
    return room;
  }
}
