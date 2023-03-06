import { literal } from '@bscotch/utility/browser';
import { z } from 'zod';

export const gameMakerFeedChannels = literal([
  'lts',
  'stable',
  'beta',
  'unstable',
]);

export const gameMakerFeedDefaultChannels = literal(['lts', 'stable', 'beta']);

export interface GameMakerSearch {
  channel?: GameMakerChannel;
  version?: string;
}

export type GameMakerChannel = z.infer<typeof gameMakerChannelSchema>;
export const gameMakerChannelSchema = z.enum(gameMakerFeedChannels);

export type GameMakerFeedOptions = z.input<typeof gameMakerFeedOptionsSchema>;
export const gameMakerFeedOptionsSchema = z.object({
  maxAgeSeconds: z.number().optional().default(3600),
});
