import type { Pathy } from '@bscotch/pathy';
import { z } from 'zod';
import type { GameMakerChannel } from './GameMakerFeeds.types.js';
export {
  gameMakerChannelSchema,
  gameMakerFeedOptionsSchema,
  type GameMakerChannel,
  type GameMakerFeedOptions,
  type GameMakerSearch,
} from './GameMakerFeeds.types.js';

export type GameMakerKnownPathId = z.infer<typeof gameMakerKnownPathIdSchema>;
const gameMakerKnownPathIdSchema = z.enum([
  'gameMakerDataDir',
  'defaultMacrosFile',
  'runtimeFeedsConfigFile',
  'initialDefaultMacrosFile',
  'runtimesCacheDir',
  'gameMakerIdeDir',
  'gameMakerIdeExe',
  'gameMakerUserDir',
  'activeUserFile',
  'uiLogFile',
  'activeRuntimeConfigFile',
]);

export type GameMakerKnownPath = z.infer<typeof gameMakerKnownPathSchema>;
export const gameMakerKnownPathSchema = z.object({
  id: gameMakerKnownPathIdSchema,
  path: z.string(),
  name: z.string(),
  description: z.string(),
});

/**
 * The subset of Stitch's `Gms2Project`
 * interface that the launcher needs access to.
 */
export interface GameMakerProject {
  readonly name: string;
  readonly yypPathAbsolute: string;
  readonly yypDirAbsolute: string;
}

export interface GameMakerInstalledVersion {
  version: string;
  executablePath: Pathy;
  directory: Pathy;
  channel?: GameMakerChannel;
  publishedAt?: Date;
  feedUrl?: string;
}

export type GameMakerParsedFeed = z.output<typeof gameMakerParsedFeedSchema>;
export const gameMakerParsedFeedSchema = z.object({
  rss: z.object({
    channel: z.object({
      title: z.string(),
      description: z.string(),
      link: z.string(),
      item: z.preprocess(
        (arg) => {
          if (!Array.isArray(arg)) {
            return [arg];
          }
          return arg;
        },
        z.array(
          z.object({
            title: z.string().regex(/^Version \d+\.\d+\.\d+\.\d+$/),
            pubDate: z.string(),
            link: z.string().optional(),
          }),
        ),
      ),
    }),
  }),
});

export interface GameMakerLogOptions {
  logDir?: string;
  /**
   * If `true`, will not include the timestamp
   * in the logfile names. This is useful when
   * you want to clobber the logs files with the
   * latest logs.
   */
  excludeLogFileTimestamps?: boolean;
}

export const gameMakerUserTokenPayloadSchema = z
  .object({
    exp: z.number(),
  })
  .passthrough();

export const gameMakerUserDataSchema = z
  .object({
    deviceID: z.string().optional(),
    login: z
      .string()
      .describe(
        "The user's email address. The 'name' part is used as the local username",
      )
      .optional(),
    userID: z
      .string()
      .describe('Local user identifier, used to construct the user directory')
      .optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
  })
  .passthrough();
export type GameMakerUserData = z.output<typeof gameMakerUserDataSchema>;

export interface GameMakerDefaultMacros {
  updateURI?: string;
  runtimeURI?: string;
}
