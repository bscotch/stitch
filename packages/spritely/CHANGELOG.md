## [2.0.2](https://github.com/bscotch/spritely/compare/v2.0.1...v2.0.2) (2021-05-27)

### Features

- Replace watcher mechanism with new one from generic debounce-watcher. ([1fcefe9](https://github.com/bscotch/spritely/commit/1fcefe9330ed74104046b83630628e7378cee2af))

## [2.0.1](https://github.com/bscotch/spritely/compare/v2.0.0...v2.0.1) (2021-05-21)

### Bug Fixes

- Switch file watcher to use polling instead of more efficient methods, since polling is a lot more stable and can work with networked drives (and, presumably, Dropbox). ([7a167f7](https://github.com/bscotch/spritely/commit/7a167f7aff5fe3c979ee6c44329e8fea5c079a26))

# [2.0.0](https://github.com/bscotch/spritely/compare/v1.8.0...v2.0.0) (2021-05-20)

### Features

- Remove the purgeTopLevelFolders option in favor of a more surgical and understandable 'enforceSyncedBatches' option. The end effect will be the same for most use cases, but this will make external watchers more stable and reduce the liklihood of deleting things that should not be deleted. ([ab16bfe](https://github.com/bscotch/spritely/commit/ab16bfe246e4a71ef7dc04f83c567dc72836fb6d))

# [1.8.0](https://github.com/bscotch/spritely/compare/v1.7.0...v1.8.0) (2021-05-19)

### Bug Fixes

- When using the CLI 'move' option, existing subimages are deleted before being replaced. This seems to break watchers in VSCode. Simply overwriting is probably less fragile. ([ea86591](https://github.com/bscotch/spritely/commit/ea865917768d95e969c218a96189c39a849f9e17))

### Features

- Only show CLI logs for Sprites whose files actually got updated. This will dramatically reduce log output clutter. ([30a68bf](https://github.com/bscotch/spritely/commit/30a68bfb3a62ec71a270a37a101ce72ce1ca97a9))

# [1.7.0](https://github.com/bscotch/spritely/compare/v1.6.11...v1.7.0) (2021-05-19)

### Bug Fixes

- Spritely CLI does not properly check error cases to know which ones can be safely ignored. ([3906aa3](https://github.com/bscotch/spritely/commit/3906aa302eb2efee5235f0f8b3a3a518c9f70104))
- The watcher is too fragile and has confusing behaviors. ([df6b412](https://github.com/bscotch/spritely/commit/df6b412139bac4c6360b6c0cc645ecb0da9e9d43))

### Features

- Add a logging utility for prettier STDOUT logs. ([2004183](https://github.com/bscotch/spritely/commit/2004183c5cef7ae5f7030f7447fb6ce569ec92c5))
- Add debug option and logging to CLI commands, and fix minor stability issues with the watcher. ([08cd56c](https://github.com/bscotch/spritely/commit/08cd56c63fc76606a7a4af137ffbda9d3f2d9fa3))
- Add Error codes to the Spritely error class, and a static method for testing a SpritelyError for a matching code/message. ([4bcbd28](https://github.com/bscotch/spritely/commit/4bcbd28220a50838233a29b4b7fd797464753353))
- Have the watcher totally restart upon completion of a run. It is getting a lot of interference from Dropbox and this might help? ([402859a](https://github.com/bscotch/spritely/commit/402859a5ea522ba99a9cf235925a2d6b0dfc6c5f))
- Replace console.log calls with the new loggers, where appropriate. ([a998476](https://github.com/bscotch/spritely/commit/a998476d9d503da5f022e6ec566aa3dc277b5670))
- Update all deps and stop tracking the package lock file. ([2ec9991](https://github.com/bscotch/spritely/commit/2ec9991ce5c4028d5a3f15da3771f59c9dfc5718))
- Use the new Spritely ErrorCodes in subimage size-checking methods. ([2cf5aa2](https://github.com/bscotch/spritely/commit/2cf5aa2eb141458bb0cb98a18c8da11abe61179a))

## [1.6.11](https://github.com/bscotch/spritely/compare/v1.6.10...v1.6.11) (2021-03-12)

### Features

- Swallow watcher EPERM errors and stop auto-restarting fixer on watch error. ([0bfe845](https://github.com/bscotch/spritely/commit/0bfe845488f8c6d518d11cc6bcad86ccae513cb4))

## [1.6.10](https://github.com/bscotch/spritely/compare/v1.6.9...v1.6.10) (2021-03-12)

### Features

- Add '--debug' CLI flag such that, when not provided, error stack traces are no longer dumped into the console. This will improve the user experience for errors that aren't a big deal. ([bed5e09](https://github.com/bscotch/spritely/commit/bed5e09b5e775f00a6453c9bcbeaa2d0038020dc))
- Add watcher event to detect when the root watched directory gets deleted, so that the watcher can turn itself off (it cannot otherwise work even when the folder gets re-created). ([989ea56](https://github.com/bscotch/spritely/commit/989ea56c6e9451aff504704e5bcff608b616fb25))

## [1.6.9](https://github.com/bscotch/spritely/compare/v1.6.8...v1.6.9) (2021-03-12)

### Bug Fixes

- Retry-able file-system functions use an error message whitelist to determine if they should retry, but this is fragile since we don't know the whole range of temporary errors caused by Dropbox interference. Instead have _all_ errors retry, and we can build a blacklist as needed. ([f9a50c2](https://github.com/bscotch/spritely/commit/f9a50c256af42a3a2baa6bdcec2a0cbc70c461c6))

## [1.6.8](https://github.com/bscotch/spritely/compare/v1.6.7...v1.6.8) (2021-03-12)

### Features

- Add error handling to the watcher, which simply re-runs itself when an error is caught. ([1c1a488](https://github.com/bscotch/spritely/commit/1c1a488282f8d006df576b3ffe90e6f0377a1bf2))
- Add extra logging context for file system failures, since these are still plaguing production. ([1e7bb78](https://github.com/bscotch/spritely/commit/1e7bb7886acc4893293fc83a6324080d81b2e4e3))
- Add uncaught/unhandled error catchers to the CLI, in case that provides more information about file system failures. ([979cc82](https://github.com/bscotch/spritely/commit/979cc82b3fc5a78fb329cea5631be046d7132a23))
- Update all dependencies. ([ca70391](https://github.com/bscotch/spritely/commit/ca70391aed76bce3705bc20c437550abbfb64c9f))

## [1.6.7](https://github.com/bscotch/spritely/compare/v1.6.6...v1.6.7) (2021-03-01)

### Features

- Update all dependencies. ([94caf5e](https://github.com/bscotch/spritely/commit/94caf5e02373a570b2899d2df59b89863ee4a5dc))

## [1.6.6](https://github.com/bscotch/spritely/compare/v1.6.5...v1.6.6) (2021-02-04)

### Bug Fixes

- Several file operations that were not retrying on failure now are doing so. This should further reduce conflicts with Dropbox and the like. ([85b1d3d](https://github.com/bscotch/spritely/commit/85b1d3d18c60587c676c55fcd68c7898cf2ca1e1))

## [1.6.5](https://github.com/bscotch/spritely/compare/v1.6.4...v1.6.5) (2021-02-03)

### Features

- Spritely batch operations now fully crop subimages if _only_ the crop action is being used. If bleed is _also_ being applied, the crop will leave behind a 1px border. ([607e899](https://github.com/bscotch/spritely/commit/607e8994d5ad4ce4ada5296c1fc821088a2e6553))
- Spritely errors now use source maps to generate traces, making debugging in production far easier. ([b581c40](https://github.com/bscotch/spritely/commit/b581c406976394dbd551dd258371527ed7421d8f))

## [1.6.4](https://github.com/bscotch/spritely/compare/v1.6.3...v1.6.4) (2021-02-03)

### Features

- Batch errors are now logged in full to make it possible to trace them to their source. ([0b45e5b](https://github.com/bscotch/spritely/commit/0b45e5b3ebc2a3abf00e3d968cb384a5183e3719))

## [1.6.3](https://github.com/bscotch/spritely/compare/v1.6.2...v1.6.3) (2021-01-28)

### Features

- Add 'retriable' wrapper on file system functions, and use those ([8a5c405](https://github.com/bscotch/spritely/commit/8a5c4051c9ed909ccc718161c6e645c6ec6e462b))
- Use retry-able file operations wherever possible in the Spritely main class. This should reduce conflicts with file system operations coming from other sources. ([1ea55ba](https://github.com/bscotch/spritely/commit/1ea55ba296fc9d07ec595866243dde66f0563c34))

## [1.6.2](https://github.com/bscotch/spritely/compare/v1.6.1...v1.6.2) (2021-01-28)

## [1.6.1](https://github.com/bscotch/spritely/compare/v1.6.0...v1.6.1) (2021-01-27)

### Bug Fixes

- The watcher is too aggressive about firing add/change events. It needs to wait until file-writing is complete and also debounce. ([0f8a3b2](https://github.com/bscotch/spritely/commit/0f8a3b2358e58eaeed5646007388b32c4f11a57d))

# [1.6.0](https://github.com/bscotch/spritely/compare/v1.5.2...v1.6.0) (2021-01-27)

### Features

- Add watcher option to CLI commands, so that new/updated images can automatically be fixed. ([d882e5a](https://github.com/bscotch/spritely/commit/d882e5a764cd430d8ca435021a36f32fda45abf2))

## [1.5.2](https://github.com/bscotch/spritely/compare/v1.5.1...v1.5.2) (2021-01-27)

### Bug Fixes

- CLI commands are borked due to breaking update to underlying dependency. ([1837902](https://github.com/bscotch/spritely/commit/1837902ab878b8f90ea3390151d4afd32d10e381))

## [1.5.1](https://github.com/bscotch/spritely/compare/v1.5.0...v1.5.1) (2021-01-27)

### Bug Fixes

- A missing 'await' can cause a sprite to be deleted before it is copied. ([9269e46](https://github.com/bscotch/spritely/commit/9269e469cad58fd5700825b6756a788ee4566550))

# [1.5.0](https://github.com/bscotch/spritely/compare/v1.4.0...v1.5.0) (2021-01-27)

### Features

- Add option to suffix sprite names with CLI method overrides. This makes it easier to add exceptions to batch operations. ([57e5171](https://github.com/bscotch/spritely/commit/57e517116aa36df6e0f5c9df44c5ae1e9db1af02))
- Have sprites that use suffixes to force CLI methods get renamed upon method application, to remove the suffix. ([32346f3](https://github.com/bscotch/spritely/commit/32346f3b1e759f17cce8bca17813391452c2b74b))

# [1.4.0](https://github.com/bscotch/spritely/compare/v1.3.1...v1.4.0) (2020-11-17)

### Features

- GradientMaps are now applied at the subimage level by default, but can be optionally applied at the sprite level. BREAKING. ([5da798f](https://github.com/bscotch/spritely/commit/5da798fcf13c5ea182da84a41670a0eecc5d7a05))

## [1.3.1](https://github.com/bscotch/spritely/compare/v1.3.0...v1.3.1) (2020-11-16)

### Features

- Uncaught errors are no longer swallowed by Spritely. This was being used to write to errors to file for convenience, but has the side effect of swalling errors in projects depending on Spritely. ([a0da00f](https://github.com/bscotch/spritely/commit/a0da00fe178bb51cac0b750785f96c82a1589e84))

# [1.3.0](https://github.com/bscotch/spritely/compare/v1.2.1...v1.3.0) (2020-11-13)

### Features

- The 'gradmap' CLI command is now an alias for the 'skin' command, which is easier to grok. ([4f3d597](https://github.com/bscotch/spritely/commit/4f3d597fab2f2cbdc88962e16f468235a1b54dff))
- The gradient-map files for skinning now have a different (backwards-incompatible) format, allowing for re-use of skins based on image filename. ([fe22df2](https://github.com/bscotch/spritely/commit/fe22df2be6aa6fbd0f311f1e56529a7a5e9bb073)), closes [#19](https://github.com/bscotch/spritely/issues/19)

## [1.2.1](https://github.com/bscotch/spritely/compare/v1.2.0...v1.2.1) (2020-11-11)

### Features

- GradientMap application will now evaluate all discovered color channels in source images. ([d8cd674](https://github.com/bscotch/spritely/commit/d8cd674596903a4da439be98cb887ed21a6df859)), closes [#15](https://github.com/bscotch/spritely/issues/15)

# [1.2.0](https://github.com/bscotch/spritely/compare/v1.1.2...v1.2.0) (2020-11-11)

### Bug Fixes

- Color objects no longer expose the reference to their RGBA values array, instead always sending clones. This prevents accidental changes to color values that aren't refelected by other values in the Color instance. ([57d9794](https://github.com/bscotch/spritely/commit/57d97943ab5732106757a63aeb8f6bb623b02013))

### Features

- A 'Color' class now exits for more easily managing RGBA values. ([6e7178c](https://github.com/bscotch/spritely/commit/6e7178c4ebfb07efe0dd3ae04b7f528e59bdde49))
- A 'Color' class now exits for more easily managing RGBA values. ([1461975](https://github.com/bscotch/spritely/commit/14619752fec53ec63711ea23f18dfdd21262dabd))
- Allow subimage sizes to mismatch if requested. Ensure that cropping still works in this scenario. ([e7764b0](https://github.com/bscotch/spritely/commit/e7764b04a1395904488075d0b597c092c15d10ad)), closes [#13](https://github.com/bscotch/spritely/issues/13)
- Can now optionally delete source images upon application of Gradient Maps. ([ac0facc](https://github.com/bscotch/spritely/commit/ac0facccaf379e758f5f289e437f35553c993980))
- Gradient mapping can now use a manually-specified mapping file. ([c24fe21](https://github.com/bscotch/spritely/commit/c24fe21665ee3580be789e3eb7c3bc739fa59984))
- Gradient maps can now be applied via the CLI. ([70c08f7](https://github.com/bscotch/spritely/commit/70c08f7e56c15db253e2f6565c5cbe7a10b31650))
- GradientMaps (as YML files) are now loaded when Spritely instances are created. ([fe79ec8](https://github.com/bscotch/spritely/commit/fe79ec853cd014afc762de3e1817c91909702e5e))
- GradientMaps (as YML files) are now loaded when Spritely instances are created. ([8409504](https://github.com/bscotch/spritely/commit/8409504a3dcd9dd99c6442039b56534698ffdab4))
- Several static methods are now marked private, since there is no need to expose them outside the Spritely class. ([e49dc8a](https://github.com/bscotch/spritely/commit/e49dc8a18edd52e0a724f3e432b660d8fe337bda))
- Several static methods are now marked private, since there is no need to expose them outside the Spritely class. ([2c38913](https://github.com/bscotch/spritely/commit/2c389131b2f53f6fb8b1c96604dc51ee1b02a364))
- Spritely instances can now apply gradient maps, creating new images as a consequence. ([d76493b](https://github.com/bscotch/spritely/commit/d76493bf94d804580b301f04c06e7748754e7dc3)), closes [#14](https://github.com/bscotch/spritely/issues/14)
- Spritely instances now allow for an options object (backwards compatible). ([08e8b3e](https://github.com/bscotch/spritely/commit/08e8b3ef01bd13a8522a42ab0911bab5626844be))
- The Color class now includes a 'toJSON' method. ([acc19cb](https://github.com/bscotch/spritely/commit/acc19cb17e8cfc8a29dfdb1bdadc64b396b74455))
- The Color class now includes a 'toJSON' method. ([0e520de](https://github.com/bscotch/spritely/commit/0e520de666526554f7a67629d80d42c786c22bbd))
- The test samples now include images for testing GradientMaps. ([bd94100](https://github.com/bscotch/spritely/commit/bd94100fb40d18419c9da0db96dadac215979c96))
- The test samples now include images for testing GradientMaps. ([84fdb41](https://github.com/bscotch/spritely/commit/84fdb4164280bbdddcc2c9e2c8634fbbc66c2a70))

## [1.1.2](https://github.com/bscotch/spritely/compare/v1.1.1...v1.1.2) (2020-10-26)

### Bug Fixes

- The now-unused 'chokidar' is no longer a dependency. ([0663120](https://github.com/bscotch/spritely/commit/06631200bec643de2b0fb8a38e83ea0425c99e95))

## [1.1.1](https://github.com/bscotch/spritely/compare/v1.1.0...v1.1.1) (2020-10-16)

# [1.1.0](https://github.com/bscotch/spritely/compare/v1.0.0...v1.1.0) (2020-10-16)

### Features

- Thrown errors are now logged prior to crashing Spritely, so that error data is not lost when pipelines complete. ([35523bd](https://github.com/bscotch/spritely/commit/35523bd50e07020c56ba7e78c99bc5f7db83b02a))

# [1.0.0](https://github.com/bscotch/spritely/compare/v0.9.0...v1.0.0) (2020-10-16)

### Features

- 'Alphaline' is now rnamed to 'bleed' in all contexts to match industry terminology. Breaking change. ([1bfa8ed](https://github.com/bscotch/spritely/commit/1bfa8ed8024c7217e7a44a64b368fcb028a6e0f8))

# [0.9.0](https://github.com/bscotch/spritely/compare/v0.8.2...v0.9.0) (2020-10-15)

### Features

- CLI commands now include the if-match option to only perform tasks on sprites matching a search filter. ([227be13](https://github.com/bscotch/spritely/commit/227be13651ae190a1fb0c3ba43e8cb89f5855a33))

## [0.8.2](https://github.com/bscotch/spritely/compare/v0.8.1...v0.8.2) (2020-10-15)

### Bug Fixes

- Purging top level folders no longer crashes when those folders don't exist in the move target. ([0bfe821](https://github.com/bscotch/spritely/commit/0bfe821075d7c4fe24e464b4316c4dac632bfcf1))

## [0.8.1](https://github.com/bscotch/spritely/compare/v0.8.0...v0.8.1) (2020-10-15)

### Bug Fixes

- CLI tools now properly clean up empty folders after moving sprite images. ([671c920](https://github.com/bscotch/spritely/commit/671c920c2cb00c9f2c6daf3952ab68494d282247))

# [0.8.0](https://github.com/bscotch/spritely/compare/v0.7.0...v0.8.0) (2020-10-14)

### Features

- CLI commands now include the option to purge top-level folders prior to moving modified images. Closes [#9](https://github.com/bscotch/spritely/issues/9) ([223d799](https://github.com/bscotch/spritely/commit/223d799da6cbb3cfa35e0e0923412c77eafd84b1))

# [0.7.0](https://github.com/bscotch/spritely/compare/v0.6.0...v0.7.0) (2020-10-14)

### Features

- CLI commands now include an option to move root-level images into sprite folders. Closes [#6](https://github.com/bscotch/spritely/issues/6) ([b669c39](https://github.com/bscotch/spritely/commit/b669c3903082191210fed54a842682ef757d0af4))
- The --watch option is no longer available for CLI commands. It's behavior was too fragile and it added too much complexity to be worth keeping around. ([e8664b2](https://github.com/bscotch/spritely/commit/e8664b2784e0dcee5d409433b19a70f77c40c77f))

# [0.6.0](https://github.com/bscotch/spritely/compare/v0.5.0...v0.6.0) (2020-10-13)

### Features

- A new SpritelyBatch class allows for easy conversion of a folder of sprite resources into a colletion of Spritely instances. ([429fa1a](https://github.com/bscotch/spritely/commit/429fa1acc1de947bfb153bf15ca3eb477c35d573))

# [0.5.0](https://github.com/bscotch/spritely/compare/v0.4.2...v0.5.0) (2020-10-12)

### Features

- Moving a sprite now cleans up empty directories left behind, and ensures there aren't any unexpected images in the destination. ([5209447](https://github.com/bscotch/spritely/commit/52094475819e0aee3aa51f75a9d6a2212e874d0f))

## [0.4.2](https://github.com/bscotch/spritely/compare/v0.4.1...v0.4.2) (2020-10-12)

### Features

- CLI users can now use the --move option for all commands. ([60ec154](https://github.com/bscotch/spritely/commit/60ec15425afe3e06d74320bc72124c15a76dc96e))
- Spritely instances can now move and delete their subimages. ([cb17b47](https://github.com/bscotch/spritely/commit/cb17b47927fe3eef5f7aecb1a31d386f5f2c3879))
- The 'fix' subcommand now allows the --move option, moving fixed images to a different file location. ([72935c8](https://github.com/bscotch/spritely/commit/72935c8dea67e12d569f6c0ae0c691b7f69e1164))

## [0.4.1](https://github.com/bscotch/spritely/compare/v0.4.0...v0.4.1) (2020-10-12)

# [0.4.0](https://github.com/bscotch/spritely/compare/v0.3.3...v0.4.0) (2020-10-12)

## [0.3.3](https://github.com/bscotch/spritely/compare/v0.3.2...v0.3.3) (2020-10-12)

### Bug Fixes

- The recursion CLI flag will actually allow for recursion. ([79f2f7b](https://github.com/bscotch/spritely/commit/79f2f7bfa5d4e6eb5f20a205bf66889f28e7619e))

### Features

- Include sample images with nesting to test against recursion. ([0216178](https://github.com/bscotch/spritely/commit/02161789bccf7b1aaa42d7eeb71d5655d3700eae))
- Spritely can now compute checksums based on pixel data, ignoring metadata, to make image comparison meaningful. ([0d109de](https://github.com/bscotch/spritely/commit/0d109de6562b27e9156b9503c2c8d5badf441f45))

## [0.3.2](https://github.com/bscotch/spritely/compare/v0.3.1...v0.3.2) (2020-10-12)

### Bug Fixes

- Commandline options will not longer fail due to missing chokidar error. ([3e66f14](https://github.com/bscotch/spritely/commit/3e66f14357c73670d0c817b75ea189442fe3d803))

## [0.3.1](https://github.com/bscotch/spritely/compare/v0.3.0...v0.3.1) (2020-10-09)

# [0.3.0](https://github.com/bscotch/spritely/compare/v0.2.0...v0.3.0) (2020-10-09)

### Bug Fixes

- Change how image foreground is detected so that alphalining the same image twice has the same result as doing so once. Closes [#3](https://github.com/bscotch/spritely/issues/3). ([3d3ea0a](https://github.com/bscotch/spritely/commit/3d3ea0a2f2225a4cf56aa17a1e3d841059a9b9a3))

### Features

- Add watcher option to sprite-alphaline command. ([cdf1fbc](https://github.com/bscotch/spritely/commit/cdf1fbc5371d40b81ecb721353d264fd9ebc90e0))
- Add watcher option to sprite-crop command. ([e994c65](https://github.com/bscotch/spritely/commit/e994c652170aa45a5b65bdf3543b51f55f98b047))
- Add watcher option to spritely-fix CLI command. ([2ce71ee](https://github.com/bscotch/spritely/commit/2ce71ee99bfdff5f4436302257962036721a6ebd))

# [0.2.0](https://github.com/bscotch/spritely/compare/v0.1.3...v0.2.0) (2020-10-09)

### Features

- Add static method to Spritely class for checking two images for equality. ([7887862](https://github.com/bscotch/spritely/commit/7887862642be1b0323fdefbc12a40b7537ce3bad))
- Add tests to ensure that cropping and alphalining actually do what they're supposed to. Closes [#1](https://github.com/bscotch/spritely/issues/1). ([d6e2ff7](https://github.com/bscotch/spritely/commit/d6e2ff7421ea7d4f2beb944907c28982a972d6ab))
- Create funding file. ([1cf2e7e](https://github.com/bscotch/spritely/commit/1cf2e7ebf6c5d76177706753afaa981df130c4a4))
- Replace Sharp-based cropping with custom cropping using image-js, using alpha-zero pixels to define background. Closes [#2](https://github.com/bscotch/spritely/issues/2) ([05d1300](https://github.com/bscotch/spritely/commit/05d1300dc118f0dfd63456f9cf79077d27cd0f1c))

## [0.1.3](https://github.com/bscotch/spritely/compare/v0.1.2...v0.1.3) (2020-10-08)

### Bug Fixes

- The alphaline script is calling crop instead of alphaline. ([e86968d](https://github.com/bscotch/spritely/commit/e86968d7aafd201fc436689b7f0bd3f7c600ed5b))

## [0.1.2](https://github.com/bscotch/spritely/compare/v0.1.1...v0.1.2) (2020-10-08)

## [0.1.1](https://github.com/bscotch/spritely/compare/v0.1.0...v0.1.1) (2020-10-08)

# [0.1.0](https://github.com/bscotch/spritely/compare/9b6be8d92e647008fd74b9a3f42151bbecb1c05b...v0.1.0) (2020-10-08)

### Features

- Add CLI command for alphaling sprites. ([b40575a](https://github.com/bscotch/spritely/commit/b40575a699f7aa52b72f1553d4f0b09336770c94))
- Add CLI command for cropping sprites, allowing it to work recursively for batching. ([27d2ccf](https://github.com/bscotch/spritely/commit/27d2ccfba882318b446af07a7fd96eb225eda05a))
- Add CLI command for generally fixing sprites (performing all tasks at once). ([0d3b061](https://github.com/bscotch/spritely/commit/0d3b061d890b6c7a3b16d414cef7a39668706e28))
- Draft the main 'Spritely' class that can be pointed at a folder of images and get information about those images, while failing if there is anything weird detected. ([1b5cca4](https://github.com/bscotch/spritely/commit/1b5cca47aa88502f894b79c5462a82765254a691))
- Implement cropping that takes subimages into account for consistent cross-subimage cropping. ([3d26e00](https://github.com/bscotch/spritely/commit/3d26e00723224705b8700b1b1ea659f32881b00f))
- Implement fixing sprite edges. ([c7e1ccb](https://github.com/bscotch/spritely/commit/c7e1ccbdd6a0c5565597e16e02b66f1429d25048))
- Initialize project with drafted README as reference. ([9b6be8d](https://github.com/bscotch/spritely/commit/9b6be8d92e647008fd74b9a3f42151bbecb1c05b))
