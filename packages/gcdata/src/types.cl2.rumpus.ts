import { z } from 'zod';

export type GameChangerRumpusMetadata = z.infer<
  typeof gameChangerRumpusMetadataSchema
>;
export const gameChangerRumpusMetadataSchema = z
  .object({
    item_metadata: z
      .record(
        z
          .object({
            srch: z.array(z.string()).optional(),
            userId: z.string(),
            store: z.string(),
            createdAt: z.string(),
            fetch_time: z.number(),
            tags: z.array(z.string()).default([]),
            name: z.string(),
            itemId: z.string(),
            map: z
              .object({
                message: z.string(),
              })
              .passthrough(),
            file_hash: z.string(),
            etag: z.string(),
            updatedAt: z.string(),
            collaborators: z.array(z.string()),
          })
          .passthrough(),
      )
      .default({}),
  })
  .passthrough()
  .default({ item_metadata: {} });
