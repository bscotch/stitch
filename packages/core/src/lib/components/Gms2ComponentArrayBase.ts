import { Yy } from '@bscotch/yy';
import { difference, uniqBy } from 'lodash-es';
import { warn } from '../../utility/log.js';
import { dehydrateArray } from '../hydrate.js';
import { StitchStorage } from '../StitchStorage.js';

export abstract class Gms2ComponentArrayBase<
  YypData,
  ComponentClass extends
    | (new (object: YypData) => InstanceType<ComponentClass> & {
        toJSON: () => YypData;
      })
    | (new (
        object: YypData,
        storage: StitchStorage,
      ) => InstanceType<ComponentClass> & { toJSON: () => YypData }),
> {
  protected items: InstanceType<ComponentClass>[] = [];

  /** Get shallow-copy array of all item instances */
  list() {
    return [...this.items];
  }

  filter(matchFunction: (item: InstanceType<ComponentClass>) => any) {
    return this.items.filter(matchFunction);
  }

  filterByField(field: keyof InstanceType<ComponentClass>, value: any) {
    return this.items.filter((item) => item[field] == value);
  }

  find(matchFunction: (item: InstanceType<ComponentClass>) => any) {
    return this.items.find(matchFunction);
  }

  findByField(field: keyof InstanceType<ComponentClass>, value: any) {
    return this.items.find((item) => item[field] == value);
  }

  removeByField(field: keyof InstanceType<ComponentClass>, value: any) {
    const itemIdx = this.items.findIndex((item) => item[field] == value);
    if (itemIdx > -1) {
      this.items.splice(itemIdx, 1);
    }
    return this;
  }

  push(...items: InstanceType<ComponentClass>[]) {
    this.items.push(...items);
    return this;
  }

  prepend(...items: InstanceType<ComponentClass>[]) {
    this.items.unshift(...items);
    return this;
  }

  abstract addNew(data: YypData): ComponentClass;

  /**
   * Create a new component instance if one doesn't already exist
   * matching the given uniqueField:uniqueValue pair.
   */
  addIfNew(
    data: YypData,
    uniqueField: keyof InstanceType<ComponentClass>,
    uniqueFieldValue: any,
  ) {
    const existing = this.findByField(uniqueField, uniqueFieldValue);
    if (!existing) {
      return this.addNew(data);
    }
    return false;
  }

  toJSON(): YypData[] {
    return dehydrateArray(this.items as any);
  }

  uniqueYypDataEntries(data: YypData[]) {
    const uniqueData = uniqBy(data, Yy.stringify);
    const removedItems = difference(data, uniqueData);
    if (removedItems.length) {
      warn(`Duplicate entries found`, { count: removedItems.length });
    }
    return uniqueData;
  }
}
