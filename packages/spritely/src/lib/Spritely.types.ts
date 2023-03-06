import type { Image } from 'image-js';

export interface GradientMapsFile {
  skins: {
    [name: string]: {
      [position: number]: string;
    };
  };
  groups?: {
    pattern: string;
    skins: string | string[];
    match?: 'sprite' | 'subimage';
  }[];
}

export type SpriteCreatedBy = 'inkscape' | 'clipstudiopaint';

export interface SpriteEdgeCorrectionOptions {
  /**
   * All art programs have their own quirks. By knowing what program
   * was used to create images we can make corrections specific to that program.
   */
  createdBy?: SpriteCreatedBy;
}

export interface ImageExt extends Image {
  getChannel(channel: number): ImageExt;
  subtractImage(
    image: ImageExt,
    options?: { bitDepth?: number; channels?: number[] },
  ): this;
}

export interface SpritelyOptions {
  /** The location of the folder corresponding to the sprite. */
  spriteDirectory?: string;
  /**
   * By default all sprite images inside `spriteDirectory`
   * must be the same size. This allows the subimages to work
   * out of the gate with GameMaker Studio, and also makes it
   * easy to take all subimages into account for auto-cropping.
   * If you bypass this requirement auto-cropping will be performed
   * on a per-image basis, making relative position changes
   * unpredictable.
   */
  allowSubimageSizeMismatch?: boolean;
  /**
   * By default, Spritely instances search for a gradmap file
   * inside the sprite's directory. You can instead specify
   * a gradient map file to be used.
   */
  gradientMapsFile?: string;
}

export interface SpritelyBoundingBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
