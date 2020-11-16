import { YypRoomOrder } from "../../types/Yyp";

export class Gms2RoomOrder {

  #data: YypRoomOrder;

  constructor(option:YypRoomOrder){
    this.#data = {...option};
  }

  toJSON(): YypRoomOrder{
    return {...this.#data};
  }
}
