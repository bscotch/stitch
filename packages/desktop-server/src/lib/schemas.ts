import { AssetSourcesConfig } from '@bscotch/stitch/asset-sources';
import { gameMakerChannelSchema } from '@bscotch/stitch-launcher';
import { v4 as uuidV4 } from 'uuid';
import { z } from 'zod';

export * from '@bscotch/stitch/asset-sources/browser';
export {
  GameMakerChannel,
  gameMakerChannelSchema,
  gameMakerFeedOptionsSchema,
  GameMakerKnownPath,
  GameMakerKnownPathId,
  GameMakerParsedFeed,
} from '@bscotch/stitch-launcher/dist/lib/GameMakerLauncher.types.js';
export { GameMakerVersionData } from './GameMakerManager.js';

export type IdeInstallStep = z.infer<typeof ideInstallStep>;
const ideInstallStep = z.enum([
  'searchingLocal',
  'installing',
  'installed',
  'failed',
  'login_required',
  'opened',
  'closed',
]);

export type IdeInstallEventPayload = z.infer<
  typeof ideInstallEventPayloadSchema
>;
export const ideInstallEventPayloadSchema = z.object({
  step: ideInstallStep,
  version: z.string(),
});

export const projectIconSchema = z.object({
  path: z.string(),
  width: z.number(),
  height: z.number(),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export const projectSummarySchema = z
  .object({
    id: z.string().uuid().default(uuidV4),
    name: z.string().min(1).describe('Project name'),
    path: z
      .string()
      .regex(/\.yyp$/)
      .describe("Path to the project's .yyp file"),
    ideVersion: z
      .string()
      .regex(/^[\d.]+$/)
      .describe('IDE version'),
    runtimeVersion: z
      .string()
      .regex(/^[\d.]+$/)
      .optional()
      .describe('Runtime version'),
    sources: z
      .object({
        audio: z
          .record(
            z.string().uuid(),
            z.string().endsWith(AssetSourcesConfig.basename),
          )
          .default({})
          .describe('Map of asset-source IDs to config paths'),
      })
      .default({}),
    icons: z.array(projectIconSchema).default([]),
  })
  .describe(
    'Key summary information about a GameMaker project for use in Stitch Desktop.',
  );
export const projectSummariesSchema = z.array(projectSummarySchema);

export type ConfigFileProject = z.infer<typeof configFileProjectSchema>;
export const configFileProjectSchema = projectSummarySchema.pick({
  id: true,
  path: true,
  sources: true,
});

// ISO 8601 date string regex
const iso8601DateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

export type State = z.infer<typeof stateSchema>;
export const stateSchema = z
  .object({
    gameMakerReleasesUnreadAfter: z.string().regex(iso8601DateRegex).optional(),
    currentProjectId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe('The most recently selected project'),
  })
  .passthrough()
  .default({});

export type ConfigFile = z.infer<typeof configFileSchema>;
export const configFileSchema = z
  .object({
    state: stateSchema,
    projects: z
      .array(configFileProjectSchema)
      .describe('List of projects added to Stitch Desktop')
      .default([]),
    feeds: z
      .array(gameMakerChannelSchema)
      .default(['lts', 'stable', 'beta'])
      .describe(
        'Which GameMaker feeds to use for discovering available IDE and Runtime versions.',
      ),
    ideInstallRoot: z
      .string()
      .optional()
      .default(process.env?.PROGRAMFILES || 'C:\\Program Files')
      .describe(
        "GameMaker installs to the user's Program Files folder by default, but the user may have changed this. Stitch Desktop must use the same location, otherwise it will not be able to find installed IDEs.",
      ),
  })
  .passthrough()
  .default({});
