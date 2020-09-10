import { YypRoomOrder } from "../../types/YypComponents";

export class Gms2ProjectRoomOrder {

  #data: YypRoomOrder;

  constructor(option:YypRoomOrder){
    this.#data = {...option};
  }

  toObject(): YypRoomOrder{
    return {...this.#data};
  }
}
