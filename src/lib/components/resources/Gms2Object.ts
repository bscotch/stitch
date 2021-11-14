import type { Gms2ProjectComms } from '@/Gms2Project.js';
import { findTokenReferences } from '@/parser/codeParser';
import { GmlToken } from '@/parser/GmlToken';
import { GmlTokenVersioned } from '@/parser/GmlTokenVersioned';
import { Defined, listFilesByExtensionSync } from '@bscotch/utility';
import { YyObject, yyDataDefaults } from '../../../types/YyObject';
import {
  Gms2ResourceBase,
  Gms2ResourceBaseParameters,
} from './Gms2ResourceBase';

export class Gms2Object extends Gms2ResourceBase<YyObject> {
  private eventsCache?: {
    /** The full event name, in format Type_Index */
    name: string;
    /** The type (e.g. Draw, Create) */
    type: string;
    /**
     * Object event files typically end with _\d or another pattern.
     * We're calling this the event "subtype".
     */
    subtype: string;
    code: string;
  }[];

  constructor(...setup: Gms2ResourceBaseParameters) {
    super('objects', ...setup);
  }

  /* This object's parent object. */
  get parentName() {
    return this.yyData.parentObjectId?.name;
  }
  /**
   * Set this object's parent object.
   * **WARNING** does not check if that object exists.
   */
  set parentName(name: string | undefined) {
    this.yyData.parentObjectId = name
      ? {
          name,
          path: `objects/${name}/${name}.yy`,
        }
      : null;
    this.save();
  }

  get spriteName() {
    return this.yyData.spriteId?.name;
  }
  set spriteName(name: string | undefined) {
    this.yyData.spriteId = name
      ? {
          name,
          path: `sprites/${name}/${name}.yy`,
        }
      : null;
    this.save();
  }

  get events(): Defined<Gms2Object['eventsCache']> {
    if (this.eventsCache) {
      return [...this.eventsCache];
    }
    this.eventsCache = [];
    const gmlFiles = listFilesByExtensionSync(this.yyDirAbsolute, 'gml');
    for (const gmlFile of gmlFiles) {
      const name = gmlFile.match(/([^/\\]+)\.gml$/)![1];
      const [type, subtype] = name.match(
        /^((.*)_(\d+))|(Collision_.*)$/,
      ) as string[];
      const code = this.storage.readBlob(gmlFile).toString();
      this.eventsCache.push({
        name,
        type,
        subtype,
        code,
      });
    }
    return this.events;
  }

  findTokenReferences(
    token: GmlToken,
    options?: { suffix?: string; includeSelf?: boolean },
  ) {
    const refs: GmlTokenVersioned[] = [];
    for (const event of this.events) {
      refs.push(
        ...findTokenReferences(event.code, token, {
          resource: this,
          suffixPattern: options?.suffix,
          includeSelf: options?.includeSelf,
          sublocation: event.name,
        }),
      );
    }
    return refs;
  }

  protected createYyFile() {
    const yyData: YyObject = {
      ...yyDataDefaults,
      name: this.name,
      parent: Gms2Object.parentDefault,
    };
    this.storage.writeJson(this.yyPathAbsolute, yyData);
  }

  private purgeCaches() {
    this.eventsCache = undefined;
  }

  /**
   * Create a new object
   * @param subimageDirectory Absolute path to a directory containing the
   *                          subimages for this sprite. Will non-recursively
   *                          search for png images within that directory
   *                          and sort them alphabetically.
   */
  static create(name: string, comms: Gms2ProjectComms) {
    return new Gms2Object(name, comms, true);
  }
}
