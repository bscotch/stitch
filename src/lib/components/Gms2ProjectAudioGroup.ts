import { YypAudioGroup } from "../../types/YypComponents";

export class Gms2ProjectAudioGroup {

  #data: YypAudioGroup;

  constructor(option:YypAudioGroup){
    this.#data = {...option};
  }

  toObject(): YypAudioGroup{
    return {...this.#data};
  }
}
