import { hydrateArray } from '../hydrate.js';
import { StitchStorage } from '../StitchStorage.js';
import { Gms2ComponentArrayBase } from './Gms2ComponentArrayBase.js';

export class Gms2ComponentArrayWithStorage<
  YypData,
  ComponentClass extends new (
    object: YypData,
    storage: StitchStorage,
  ) => InstanceType<ComponentClass> & { toJSON(): YypData },
> extends Gms2ComponentArrayBase<YypData, ComponentClass> {
  constructor(
    data: YypData[],
    protected componentClass: ComponentClass,
    protected storage: StitchStorage,
  ) {
    super();
    // Remove duplicates
    this.items = hydrateArray(
      this.uniqueYypDataEntries(data),
      this.componentClass,
      this.storage,
    );
  }

  // @ts-expect-error Typescript does not like the use of a different function signature in overrides
  addNew(data: YypData) {
    const newInstance = new this.componentClass(data, this.storage);
    this.push(newInstance);
    return newInstance;
  }
}
