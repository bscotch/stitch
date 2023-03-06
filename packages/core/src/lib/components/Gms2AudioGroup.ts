import { YypAudioGroup } from '@bscotch/yy';

export class Gms2AudioGroup {
  #data: YypAudioGroup;

  constructor(option: YypAudioGroup) {
    this.#data = { ...option };
  }

  get name() {
    return this.#data.name;
  }

  toJSON(): YypAudioGroup {
    return { ...this.#data };
  }
}
