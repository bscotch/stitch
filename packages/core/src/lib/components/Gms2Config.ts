import { YypConfig } from '@bscotch/yy';
import { dehydrateArray, hydrateArray } from '../hydrate.js';

interface ConfigData extends Omit<YypConfig, 'children'> {
  children: Gms2Config[];
}

export class Gms2Config {
  private data: ConfigData;

  constructor(option: YypConfig) {
    this.data = {
      ...option,
      children: option?.children?.length
        ? hydrateArray(option.children, Gms2Config)
        : [],
    };
  }

  get name() {
    return this.data.name;
  }

  addChild(name: string) {
    this.data.children.push(new Gms2Config({ name, children: [] }));
  }

  findChild(name: string) {
    return this.data.children.find((child) => child.name == name);
  }

  toJSON(): YypConfig {
    return {
      ...this.data,
      children: dehydrateArray(this.data.children),
    };
  }
}
