import { listFilesByExtensionSync } from '@bscotch/utility';
import {
  YyObject,
  YyObjectEvent,
  YyObjectEventName,
  yyObjectEventNames,
  YyObjectEventNumber,
  yyObjectEventNums,
} from '@bscotch/yy';
import { assert } from '../../../utility/errors.js';
import paths from '../../../utility/paths.js';
import { findTokenReferences } from '../../parser/codeParser.js';
import { GmlToken } from '../../parser/GmlToken.js';
import { GmlTokenVersioned } from '../../parser/GmlTokenVersioned.js';
import type { StitchProjectComms } from '../../StitchProject.js';
import {
  Gms2ResourceBase,
  Gms2ResourceBaseParameters,
} from './Gms2ResourceBase.js';

export class Gms2ObjectEvent {
  constructor(
    protected data: YyObjectEvent,
    readonly dir: string,
    readonly io: StitchProjectComms,
  ) {}

  get eventNum() {
    return this.data.eventNum;
  }

  get eventType() {
    return this.data.eventType;
  }

  /**
   * @example
   * "Draw"
   */
  get name() {
    const name =
      yyObjectEventNames[
        this.data.eventType as keyof typeof yyObjectEventNames
      ];
    assert(name, `Unknown event type ${this.data.eventType}`);
    return name;
  }

  /**
   * @example
   * "Draw_0"
   */
  get fullName() {
    return `${this.name}_${this.data.eventNum}`;
  }

  get fileName() {
    return `${this.fullName}.gml`;
  }

  get filePath() {
    return paths.join(this.dir, this.fileName);
  }

  get code() {
    if (!this.io.storage.existsSync(this.filePath)) {
      return '';
    }
    return this.io.storage.readTextSync(this.filePath);
  }

  set code(code: string) {
    this.io.storage.writeBlobSync(this.filePath, code);
  }
}

export class Gms2Object extends Gms2ResourceBase<YyObject> {
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

  get codeFilePathsAbsolute(): string[] {
    return listFilesByExtensionSync(this.yyDirAbsolute, 'gml');
  }

  findEvent(eventType: YyObjectEventName | YyObjectEventNumber, eventNum = 0) {
    return this.events().find((e) => {
      if (e.eventType !== eventNum) {
        return false;
      }
      return typeof eventType === 'string'
        ? e.name === eventType
        : e.eventNum === eventType;
    });
  }

  protected addEvent(
    eventType: YyObjectEventNumber,
    eventNum = 0,
  ): Gms2ObjectEvent {
    let event: Gms2ObjectEvent | undefined = this.findEvent(
      eventType,
      eventNum,
    );
    if (!event) {
      this.yyData.eventList.push({
        isDnD: false,
        eventNum,
        eventType,
        collisionObjectId: null,
        resourceVersion: '1.0',
        name: '',
        tags: [],
        resourceType: 'GMEvent',
      });
      this.save();
      event = this.findEvent(eventType, eventNum);
      assert(event, `Could not find event ${eventNum} after creating it`);
    }
    return event;
  }

  addCreateEvent() {
    return this.addEvent(yyObjectEventNums.Create);
  }

  events(): Gms2ObjectEvent[] {
    return this.yyData.eventList.map(
      (data) => new Gms2ObjectEvent(data, this.yyDirAbsolute, this.io),
    );
  }

  findTokenReferences(
    token: GmlToken,
    options?: { suffix?: string; includeSelf?: boolean },
  ) {
    const refs: GmlTokenVersioned[] = [];
    for (const event of this.events()) {
      refs.push(
        ...findTokenReferences(event.code, token, {
          resource: this,
          suffixPattern: options?.suffix,
          includeSelf: options?.includeSelf,
          sublocation: event.fullName,
        }),
      );
    }
    return refs;
  }

  /**
   * Create a new object
   * @param subimageDirectory Absolute path to a directory containing the
   *                          subimages for this sprite. Will non-recursively
   *                          search for png images within that directory
   *                          and sort them alphabetically.
   */
  static async create(name: string, comms: StitchProjectComms) {
    const obj = new Gms2Object(name, comms);
    await obj.replaceYyFile({
      name: obj.name,
    });
    return obj;
  }
}
