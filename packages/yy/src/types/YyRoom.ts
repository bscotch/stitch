// Generated by ts-to-zod
import { z } from 'zod';
import { yyBaseSchema } from './YyBase.js';
import {
  fixedNumber,
  randomString,
  unstable,
  yyResourceIdSchemaGenerator,
} from './utility.js';

export type YyRoomView = z.infer<typeof yyRoomViewSchema>;
const yyRoomViewSchema = unstable({
  inherit: z.boolean().default(false),
  visible: z.boolean().default(false),
  xview: z.number().default(0),
  yview: z.number().default(0),
  wview: z.number().default(1366),
  hview: z.number().default(768),
  xport: z.number().default(0),
  yport: z.number().default(0),
  wport: z.number().default(1366),
  hport: z.number().default(768),
  hborder: z.number().default(32),
  vborder: z.number().default(32),
  hspeed: z.number().default(-1),
  vspeed: z.number().default(-1),
  /** The object being followed */
  objectId: z.unknown().nullable().default(null),
});

export type YyRoomInstance = z.infer<typeof yyRoomInstanceSchema>;
export const yyRoomInstanceSchema = unstable({
  /**
   * *Unique* instance name. Can be any string. Needed to allow multiple
   * instances of the same object to be added to a room via the editor.
   */
  name: z.string().default(() => randomString()),
  properties: z.array(z.unknown()).default([]),
  isDnd: z.boolean().default(false),
  /** The type of the object being instanced */
  objectId: yyResourceIdSchemaGenerator('objects'),
  inheritCode: z.boolean().default(false),
  hasCreationCode: z.boolean().default(false),
  colour: z.number().default(4294967295),
  rotation: fixedNumber().default(0),
  scaleX: fixedNumber().default(1),
  scaleY: fixedNumber().default(1),
  imageIndex: z.number().default(0),
  imageSpeed: fixedNumber().default(1),
  inheritedItemId: z.unknown().nullable().default(null),
  frozen: z.boolean().default(false),
  ignore: z.boolean().default(false),
  inheritItemSettings: z.boolean().default(false),
  /**
   * Initial x-coords of the instance
   */
  x: fixedNumber().default(0),
  /**
   * Initial y-coords of the instance
   */
  y: fixedNumber().default(0),
  resourceVersion: z.string().default('1.0'),
  tags: z.array(z.string()).optional(),
  resourceType: z.literal('GMRInstance').default('GMRInstance'),
});

export type YyRoomLayerBase = z.infer<typeof yyRoomLayerBaseSchema>;
const yyRoomLayerBaseSchema = unstable({
  visible: z.boolean().default(true),
  effectEnabled: z.boolean().optional().default(true),
  effectType: z.unknown().optional().default(null),
  userdefinedDepth: z.boolean().default(false),
  inheritLayerDepth: z.boolean().default(false),
  inheritLayerSettings: z.boolean().default(false),
  inheritVisibility: z.boolean().default(true),
  inheritSubLayers: z.boolean().default(true),
  gridX: z.number().default(32),
  gridY: z.number().default(32),
  layers: z.array(z.unknown()).default([]),
  hierarchyFrozen: z.boolean().default(false),
  properties: z.array(z.unknown()).optional().default([]),
});

export type YyRoomPathLayer = z.infer<typeof yyRoomPathLayerSchema>;
const yyRoomPathLayerSchema = z
  .object({
    resourceType: z.literal('GMRPathLayer'),
    resourceVersion: z.string().default('1.0'),
    name: z.string(),
    depth: z.number().default(0),
    effectEnabled: z.boolean().default(true),
    effectType: z.unknown().nullable().default(null),
    gridX: z.number().default(32),
    gridY: z.number().default(32),
    hierarchyFrozen: z.boolean().default(false),
    inheritLayerDepth: z.boolean().default(false),
    inheritLayerSettings: z.boolean().default(false),
    inheritSubLayers: z.boolean().default(true),
    inheritVisibility: z.boolean().default(true),
    layers: z.array(z.unknown()).nullable().default([]),
    pathId: z
      .object({
        name: z.string(),
        path: z.string(),
      })
      .nullable()
      .default(null),
    userdefinedDepth: z.boolean().default(false),
    visible: z.boolean().default(true),
  })
  .passthrough();

export type YyRoomTileLayer = z.infer<typeof yyRoomTileLayerSchema>;
const yyRoomTileLayerSchema = z
  .object({
    resourceType: z.literal('GMRTileLayer'),
    resourceVersion: z.string().default('1.1'),
    name: z.string().default('Tiles'),
    depth: z.number().default(0),
    effectEnabled: z.boolean().default(true),
    effectType: z.unknown().optional().nullable().default(null),
    gridX: z.number().default(32),
    gridY: z.number().default(32),
    hierarchyFrozen: z.boolean().default(false),
    inheritLayerDepth: z.boolean().default(false),
    inheritLayerSettings: z.boolean().default(false),
    inheritSubLayers: z.boolean().default(true),
    inheritVisibility: z.boolean().default(true),
    layers: z.array(z.unknown()).default([]),
    properties: z.array(z.unknown()).default([]),
    tiles: z
      .object({
        SerialiseHeight: z.number().default(32),
        SerialiseWidth: z.number().default(32),
        TileCompressedData: z.unknown().optional(),
        TileDataFormat: z.number().default(1),
      })
      .passthrough(),
    tilesetId: z
      .object({ name: z.string(), path: z.string() })
      .passthrough()
      .nullable(),
    userdefinedDepth: z.boolean().default(false),
    visible: z.boolean().default(true),
    x: z.number().default(0),
    y: z.number().default(0),
  })
  .passthrough();

export type YyRoomEffectLayer = z.infer<typeof yyRoomEffectLayer>;
const yyRoomEffectLayer = z
  .object({
    resourceType: z.literal('GMREffectLayer'),
  })
  .passthrough();

export type YyRoomInstanceLayer = z.infer<typeof yyRoomInstanceLayerSchema>;
const yyRoomInstanceLayerSchema = yyRoomLayerBaseSchema
  .extend({
    instances: z.array(yyRoomInstanceSchema).default([]),
    depth: z.number().default(0),
    resourceVersion: z.string().default('1.0'),
    /**
     * @default "Instances"
     */
    name: z.string().default('Instances'),
    tags: z.array(z.string()).optional(),
    resourceType: z.literal('GMRInstanceLayer'),
  })
  .passthrough();

export type YyRoomAssetLayer = z.infer<typeof yyRoomAssetLayerSchema>;
const yyRoomAssetLayerSchema = z
  .object({
    resourceType: z.literal('GMRAssetLayer'),
    resourceVersion: z.string().default('1.0'),
    name: z.string(),
    assets: z.array(z.unknown()).default([]),
    depth: z.number().default(0),
    effectEnabled: z.boolean().default(true),
    effectType: z.unknown().nullable().default(null),
    gridX: z.number().default(32),
    gridY: z.number().default(32),
    hierarchyFrozen: z.boolean().default(false),
    inheritLayerDepth: z.boolean().default(false),
    inheritLayerSettings: z.boolean().default(false),
    inheritSubLayers: z.boolean().default(true),
    inheritVisibility: z.boolean().default(true),
    layers: z.array(z.unknown()).default([]),
    properties: z.array(z.unknown()).default([]),
    userdefinedDepth: z.boolean().default(true),
    visible: z.boolean().default(true),
  })
  .passthrough();

export type YyRoomBackgroundLayer = z.infer<typeof yyRoomBackgroundLayerSchema>;
const yyRoomBackgroundLayerSchema = yyRoomLayerBaseSchema.extend({
  spriteId: z
    .object({
      name: z.string(),
      path: z.string(),
    })
    .passthrough()
    .nullable()
    .default(null),
  colour: z.number().default(4278190080),
  x: z.number().default(0),
  y: z.number().default(0),
  htiled: z.boolean().default(false),
  vtiled: z.boolean().default(false),
  hspeed: z.number().default(0),
  vspeed: z.number().default(0),
  stretch: z.boolean().default(false),
  animationFPS: z.number().default(15),
  animationSpeedType: z.number().default(0),
  userdefinedAnimFPS: z.boolean().default(false),
  depth: z.number().default(100),
  properties: z.array(z.unknown()).optional(),
  resourceVersion: z.string().default('1.0'),
  /**
   * @default "Background"
   */
  name: z.string().default('Background'),
  tags: z.array(z.string()).optional(),
  resourceType: z.literal('GMRBackgroundLayer'),
});

export type YyRoomLayerLayer = z.infer<typeof yyRoomLayerLayerSchema>;
const yyRoomLayerLayerSchema = z.object({
  resourceType: z.literal('GMRLayer'),
  resourceVersion: z.string().default('1.0'),
  name: z.string().default('instances'),
  depth: z.number().default(0),
  effectEnabled: z.boolean().default(true),
  effectType: z.unknown().nullable().default(null),
  gridX: z.number().default(32),
  gridY: z.number().default(32),
  hierarchyFrozen: z.boolean().default(false),
  inheritLayerDepth: z.boolean().default(false),
  inheritLayerSettings: z.boolean().default(false),
  inheritSubLayers: z.boolean().default(true),
  inheritVisibility: z.boolean().default(true),
  layers: z.array(z.unknown()).default([]),
  properties: z.array(z.unknown()).default([]),
  userdefinedDepth: z.boolean().default(false),
  visible: z.boolean().default(true),
});

export type YyRoomInstanceCreationOrderEntry = z.infer<
  typeof yyRoomInstanceCreationOrderEntrySchema
>;
const yyRoomInstanceCreationOrderEntrySchema = z.object({
  /**
   * The *instance name*, which can be custom.
   * Must match one of the YyRoomInstance names.
   */
  name: z.string(),
  /** The room's path */
  path: z.string(),
});

/** @discriminator resourceType */
export type YyRoomLayer = z.infer<typeof yyRoomLayerSchema>;
const yyRoomLayerSchema = z.discriminatedUnion('resourceType', [
  yyRoomInstanceLayerSchema,
  yyRoomBackgroundLayerSchema,
  yyRoomTileLayerSchema,
  yyRoomAssetLayerSchema,
  yyRoomPathLayerSchema,
  yyRoomLayerLayerSchema,
  yyRoomEffectLayer,
]);

export type YyRoom = z.infer<typeof yyRoomSchema>;
export const yyRoomSchema = yyBaseSchema.extend({
  layers: z.array(yyRoomLayerSchema).default([]),
  instanceCreationOrder: z
    .array(yyRoomInstanceCreationOrderEntrySchema)
    .default([]),
  roomSettings: unstable({
    inheritRoomSettings: z.boolean().default(false),
    Width: z.number().default(1366),
    Height: z.number().default(768),
    persistent: z.boolean().default(false),
  }).default({}),
  viewSettings: unstable({
    inheritViewSettings: z.boolean().default(false),
    enableViews: z.boolean().default(false),
    clearViewBackground: z.boolean().default(false),
    clearDisplayBuffer: z.boolean().default(true),
  }).default({}),
  physicsSettings: unstable({
    inheritPhysicsSettings: z.boolean().default(false),
    PhysicsWorld: z.boolean().default(false),
    PhysicsWorldGravityX: fixedNumber().default(0),
    PhysicsWorldGravityY: fixedNumber().default(10),
    PhysicsWorldPixToMetres: fixedNumber().default(0),
  }).default({}),
  isDnd: z.boolean().default(false),
  volume: fixedNumber().default(10),
  parentRoom: z.unknown().nullable().default(null),
  /**
   * 8 identical 'views' are created by default.
   * @default []
   */
  views: z.array(yyRoomViewSchema).default([]),
  inheritLayers: z.boolean().default(false),
  creationCodeFile: z.string().default("''"),
  inheritCode: z.boolean().default(false),
  inheritCreationOrder: z.boolean().default(false),
  sequenceId: z.unknown().default(null),
  resourceType: z.literal('GMRoom').default('GMRoom'),
});
