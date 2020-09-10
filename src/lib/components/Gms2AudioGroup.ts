import { YypAudioGroup } from "../../types/YypComponents";

export class Gms2AudioGroup {

  #data: YypAudioGroup;

  constructor(option:YypAudioGroup){
    this.#data = {...option};
  }

  get dehydrated(): YypAudioGroup{
    return {...this.#data};
  }
}
