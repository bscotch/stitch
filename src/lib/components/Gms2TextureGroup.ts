import { YypTextureGroup } from '../../types/Yyp';

export class Gms2TextureGroup {
  #data: YypTextureGroup;

  constructor(option: YypTextureGroup) {
    this.#data = { ...option };
  }

  get name() {
    return this.#data.name;
  }

  toJSON(): YypTextureGroup {
    return { ...this.#data };
  }

  static get defaultDataValues(): Omit<YypTextureGroup, 'name'> {
    return {
      // groupParent: {
      //   name: string,
      //   path: string
      // },
      isScaled: true,
      autocrop: true,
      border: 2,
      mipsToGenerate: 0,
      targets: BigInt('461609314234257646'),
      resourceType: 'GMTextureGroup',
      resourceVersion: '1.0',
    };
  }
}
