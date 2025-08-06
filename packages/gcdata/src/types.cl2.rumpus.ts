import { z } from 'zod';

export type GameChangerRumpusMetadata = z.infer<
  typeof gameChangerRumpusMetadataSchema
>;
export const gameChangerRumpusMetadataSchema = z
  .looseObject({
    item_metadata: z
      .record(
        z.string(),
        z.looseObject({
          srch: z.array(z.string()).optional(),
          userId: z.string(),
          store: z.string(),
          createdAt: z.string(),
          fetch_time: z.number(),
          tags: z.array(z.string()).default([]),
          name: z.string(),
          itemId: z.string(),
          map: z
            .looseObject({
              message: z.string(),
            }),
          file_hash: z.string(),
          etag: z.string(),
          updatedAt: z.string(),
          collaborators: z.array(z.string()),
        }),
      )
      .default({}),
  })
  .default({ item_metadata: {} });
