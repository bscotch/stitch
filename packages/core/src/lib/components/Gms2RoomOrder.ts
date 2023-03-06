import { YypRoomOrderNode } from '@bscotch/yy';

export class Gms2RoomOrder<RoomOrderVersion extends YypRoomOrderNode> {
  #data: RoomOrderVersion;

  constructor(option: RoomOrderVersion) {
    this.#data = { ...option };
  }

  get id() {
    return this.#data.roomId;
  }

  get name() {
    return this.#data.roomId.name;
  }

  get path() {
    return this.#data.roomId.path;
  }

  toJSON(): RoomOrderVersion {
    return { ...this.#data };
  }
}
