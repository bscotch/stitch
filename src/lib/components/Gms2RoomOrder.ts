import { YypRoomOrder } from "../../types/YypComponents";

export class Gms2RoomOrder {

  #data: YypRoomOrder;

  constructor(option:YypRoomOrder){
    this.#data = {...option};
  }

  get dehydrated(): YypRoomOrder{
    return {...this.#data};
  }
}
