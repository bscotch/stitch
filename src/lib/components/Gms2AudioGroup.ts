import { YypAudioGroup } from "../../types/YypComponents";

export class Gms2AudioGroup {

  #data: YypAudioGroup;

  constructor(option:YypAudioGroup){
    this.#data = {...option};
  }

  get name(){ return this.#data.name; }

  get dehydrated(): YypAudioGroup{
    return {...this.#data};
  }

  static get defaultDataValues(): Omit<YypAudioGroup,'name'>{
    return {
      targets: BigInt('461609314234257646'),
      resourceType: "GMAudioGroup",
      resourceVersion: "1.0",
    };
  }
}
