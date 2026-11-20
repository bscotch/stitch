/**
 * @file Browser-compatible exports: everything needed to fetch, validate,
 * and work with Stitch's unified GameMaker releases feed.
 */
export {
  channelNames,
  channels,
  getChannel,
  type KnownChannelName,
} from './channels.ts';
export {
  fetchReleasesFeed,
  releasesSchemaUrl,
  releasesUrl,
} from './releases.ts';
export {
  channelInfoSchema,
  channelNameSchema,
  platforms,
  releaseSchema,
  releasesFeedJsonSchema,
  releasesFeedSchema,
  runtimeReleaseSchema,
  versionSchema,
  type ChannelInfo,
  type GameMakerRelease,
  type GameMakerReleasesFeed,
  type GameMakerRuntimeRelease,
  type Platform,
} from './schemas.ts';
