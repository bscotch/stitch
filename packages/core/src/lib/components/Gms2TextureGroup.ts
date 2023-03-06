import { YypTextureGroup } from '@bscotch/yy';

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
}
