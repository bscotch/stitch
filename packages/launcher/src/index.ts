/**
 * @file Public API of `@bscotch/stitch-launcher`: manage cached GameMaker
 * IDE versions, find installed runtimes, open projects, and run Igor.
 */
export {
  isLauncherError,
  LauncherError,
  type LauncherErrorCode,
  type LauncherErrorData,
  type UnpackerErrorData,
} from './lib/errors.ts';
export { getReleasesFeed, normalizeVersion } from './lib/feed.ts';
export {
  findIde,
  getIdeCacheInfo,
  listAvailableIdes,
  pruneIdeCache,
  type CachedIde,
  type CachedIdeWithSize,
} from './lib/ideCache.ts';
export {
  buildIgorCommand,
  defaultIgorTarget,
  formatShellCommand,
  igorArtifactExtension,
  type IgorCommand,
  type IgorCompiler,
  type IgorShell,
  type ResolvedIgorOptions,
} from './lib/igor/command.ts';
export {
  getIgorCacheInfo,
  igorCacheKey,
  pruneIgorCache,
  type IgorCacheEntry,
  type IgorCacheMeta,
} from './lib/igor/cache.ts';
export * from './lib/igor/cliTypes.ts';
export {
  prepareIgorCommand,
  runIgor,
  type IgorOptions,
  type IgorResult,
  type PreparedIgorCommand,
} from './lib/igor/run.ts';
export {
  checkPrerequisites,
  getInstallerPath,
  installIde,
  type InstallIdeOptions,
  type InstallProgress,
  type Prerequisites,
} from './lib/install.ts';
export {
  listPaths,
  type GameMakerPath,
  type GameMakerPathId,
} from './lib/listPaths.ts';
export {
  openProject,
  readProjectIdeVersion,
  type OpenProjectOptions,
  type RunningIde,
} from './lib/openProject.ts';
export {
  resolveOptions,
  type AnyLauncherOptions,
  type LauncherLogger,
  type LauncherOptions,
  type ResolvedOptions,
} from './lib/options.ts';
export {
  channelForProgramDirName,
  channelsForProgramDirName,
  computeGameMakerDirs,
  knownProgramDirNames,
  programDirNameForChannel,
  type GameMakerDirs,
} from './lib/paths.ts';
export {
  getPlatformLayer,
  type OsName,
  type PlatformEnv,
} from './lib/platform/index.ts';
export {
  findRuntime,
  listInstalledRuntimes,
  type InstalledRuntime,
  type RuntimeModule,
} from './lib/runtimes.ts';
export {
  findSevenZip,
  sevenZipDownloadUrl,
  type SevenZipInfo,
} from './lib/sevenZip.ts';
export { findUnpacker, type InstallerUnpacker } from './lib/unpacker.ts';
export { restoreUpdatePrompts } from './lib/updatePrompt.ts';
export {
  getIdeVersionDetails,
  type IdeVersionDetails,
} from './lib/versions.ts';
export {
  buildInstallScript,
  checkSystemRequirements,
  linuxRequirements,
  type RequirementDefinition,
  type RequirementGroup,
  type RequirementProbe,
  type SystemRequirement,
  type SystemRequirementsReport,
} from './lib/requirements.ts';
