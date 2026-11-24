export interface SpineJson<
  AnimationName extends string = string,
  SlotName extends string = string,
  BoneName extends string = string,
  EventName extends string = string,
  AttachmentName extends string = string,
> {
  skeleton: SpineSkeleton;
  bones: SpineBone<BoneName>[];
  slots: SpineSlot<SlotName, BoneName, AttachmentName>[];
  skins: SpineSkin<SlotName, AttachmentName>[];
  events: SpineEvents<EventName>;
  animations: SpineAnimations<
    AnimationName,
    SlotName,
    BoneName,
    EventName,
    AttachmentName
  >;
}

type SpineEvents<EventName extends string = string> = {
  [eventName in EventName]: unknown;
};

interface SpineSkeleton {
  hash: string;
  /** Our version is 4.0.56 */
  spine: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fps: number;
  images: string;
  audio: string;
}

interface SpineBone<BoneName extends string = string> {
  name: BoneName;
  parent?: string;
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
}

interface SpineSlot<
  SlotName extends string = string,
  BoneName extends string = string,
  AttachmentName extends string = string,
> {
  name: SlotName;
  bone: BoneName;
  attachment: AttachmentName;
}

interface SpineSkin<
  SlotName extends string = string,
  AttachmentName extends string = string,
> {
  name: string;
  attachments: {
    [Slot in SlotName]?: {
      [Attachment in AttachmentName]?: {
        x: number;
        y: number;
        width: number;
        height: number;
        type?: string;
        uvs?: number[];
        triangles?: number[];
        vertices?: number[];
        hull?: number;
        edges?: number[];
      };
    };
  };
}

type SpineAnimations<
  AnimationName extends string = string,
  SlotName extends string = string,
  BoneName extends string = string,
  EventName extends string = string,
  AttachmentName extends string = string,
> = {
  [name in AnimationName]: SpineAnimation<
    SlotName,
    BoneName,
    EventName,
    AttachmentName
  >;
};

export interface SpineAnimation<
  SlotName extends string = string,
  BoneName extends string = string,
  EventName extends string = string,
  AttachmentName extends string = string,
> {
  slots: {
    [slotName in SlotName]: {
      attachment: { name: AttachmentName | null; time?: number }[];
      rgba?: TimeConfig[];
    };
  };
  bones: {
    [boneName in BoneName]: {
      rotate?: TimeConfig[];
      translate?: TimeConfig[];
      scale?: TimeConfig[];
      shear?: TimeConfig[];
    };
  };
  events: { time: number; name: EventName }[];
  drawOrder?: TimeConfig[];
  deform?: unknown;
}

type TimeConfig = { time?: number; [key: string]: unknown };
