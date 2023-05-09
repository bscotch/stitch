import { Pathy } from '@bscotch/pathy';
import type { GameMakerResource } from './project.resource.js';

export class GmlFile {
  readonly kind = 'gmlFile';
  protected _content!: string;

  constructor(
    readonly resource: GameMakerResource,
    readonly path: Pathy<string>,
  ) {}

  get name() {
    return this.path.name;
  }

  get basename() {
    return this.path.basename;
  }

  get content() {
    return this._content;
  }

  async load(path: Pathy<string>) {
    this._content = await path.read();
  }
}
