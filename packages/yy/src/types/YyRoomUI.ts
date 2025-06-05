import { z } from 'zod';
import { yyParentSchema } from './YyBase.js';

export type YyRoomUI = z.infer<typeof yyRoomUISchema>;
export const yyRoomUISchema = z
  .object({
    $GMRoomUI: z.string().default(''),
    '%Name': z.literal('RoomUI').default('RoomUI'),
    children: z.array(z.any()).default([]),
    locked: z.boolean().default(false),
    name: z.literal('RoomUI').default('RoomUI'),
    parent: yyParentSchema,
    resourceType: z.literal('GMRoomUI').default('GMRoomUI'),
    resourceVersion: z.string().default('2.0'),
    viewspaceChildren: z.array(z.any()).default([]),
    visible: z.boolean().default(true),
  })
  .passthrough();
