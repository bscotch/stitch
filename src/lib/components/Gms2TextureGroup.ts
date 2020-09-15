import { YypTextureGroup } from "../../types/YypComponents";

export class Gms2TextureGroup {

  #data: YypTextureGroup;

  constructor(option:YypTextureGroup){
    this.#data = {...option};
  }

  get name(){ return this.#data.name; }

  get dehydrated(): YypTextureGroup{
    return {...this.#data};
  }

  static create(name:string){
    const data: YypTextureGroup = {
      name,
      // groupParent: {
      //   name: string,
      //   path: string
      // },
      isScaled: true,
      autocrop: false,
      border: 2,
      mipsToGenerate: 0,
      targets: BigInt('461609314234257646'),
      resourceType: "GMTextureGroup",
      resourceVersion: "1.0",
    };
  }
}
