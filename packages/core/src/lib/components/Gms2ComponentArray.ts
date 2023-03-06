import { hydrateArray } from '../hydrate.js';
import { Gms2ComponentArrayBase } from './Gms2ComponentArrayBase.js';

export class Gms2ComponentArray<
  YypData,
  ComponentClass extends new (
    object: YypData,
  ) => InstanceType<ComponentClass> & { toJSON: () => YypData },
> extends Gms2ComponentArrayBase<YypData, ComponentClass> {
  constructor(data: YypData[], private componentClass: ComponentClass) {
    super();
    // Remove duplicates
    this.items = hydrateArray(
      this.uniqueYypDataEntries(data),
      this.componentClass,
    );
  }

  // @ts-expect-error Typescript does not like the use of a different function signature in overrides
  override addNew(data: YypData, options?: { prepend?: boolean }) {
    const newComponent = new this.componentClass(data);
    if (options?.prepend) {
      this.prepend(newComponent);
    } else {
      this.push(newComponent);
    }
    return newComponent;
  }
}
