import { YypRoomOrder, YypRoomOrderNode } from '../../types/Yyp';

export class Gms2RoomOrder<
  RoomOrderVersion extends YypRoomOrder | YypRoomOrderNode,
> {
  #data: RoomOrderVersion;

  constructor(option: RoomOrderVersion) {
    this.#data = { ...option };
  }

  toJSON(): RoomOrderVersion {
    return { ...this.#data };
  }
}
