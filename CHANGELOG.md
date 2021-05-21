## [2.10.5](https://github.com/bscotch/stitch/compare/v2.10.4...v2.10.5) (2021-05-21)


### Bug Fixes

* Switch watcher to use polling since the native method does not appear to work with Dropbox. ([025e5ac](https://github.com/bscotch/stitch/commit/025e5acbc7fef9ab06d0934d7877635aa1c801c6))



## [2.10.4](https://github.com/bscotch/stitch/compare/v2.10.3...v2.10.4) (2021-05-20)


### Bug Fixes

* The watcher is not ignoring permission errors, which may be causing problems with Drobpox. ([c694e32](https://github.com/bscotch/stitch/commit/c694e326ef9cbd8901299086283624f813d710fe))



## [2.10.3](https://github.com/bscotch/stitch/compare/v2.10.2...v2.10.3) (2021-05-20)


### Features

* Add more debug logs to the watcher to help diagnose issues. ([06f44de](https://github.com/bscotch/stitch/commit/06f44de8a24cda27f806ad604e935c86f4a058a6))



## [2.10.2](https://github.com/bscotch/stitch/compare/v2.10.1...v2.10.2) (2021-05-20)


### Bug Fixes

* The add-sprite watcher does not appear to be triggering on source change. ([df83fba](https://github.com/bscotch/stitch/commit/df83fba443b99ebd93f6d6e95a54e2c1bb7d5d44))



## [2.10.1](https://github.com/bscotch/stitch/compare/v2.10.0...v2.10.1) (2021-05-20)


### Features

* Add timestamps to logging functions and add log output to watchers. ([0df0fde](https://github.com/bscotch/stitch/commit/0df0fde9ce831b81c2e252a8bbd9fc5884af686e))



# [2.10.0](https://github.com/bscotch/stitch/compare/v2.9.0...v2.10.0) (2021-05-20)


### Bug Fixes

* Remove misc unused references. ([3b8cfa8](https://github.com/bscotch/stitch/commit/3b8cfa86792782e82a550bdf2e435a58e60d2b1c))


### Features

* Add watch option to CLI command 'stitch add files'. ([d47246b](https://github.com/bscotch/stitch/commit/d47246bf5fe1b0d81058ed4e709de02614965620))
* Add watch option to CLI command 'stitch add sounds'. ([58c9c0c](https://github.com/bscotch/stitch/commit/58c9c0c80fef43eb84acf539dcad2f0497ce7539))
* Add watcher methods for easily converting CLI calls into ones that repeat when files change. ([f3c4bef](https://github.com/bscotch/stitch/commit/f3c4bef46918a90dbd68c0ffad539999dffcbef4))
* Add watcher option to CLI command 'stitch add sprites'. ([82ad243](https://github.com/bscotch/stitch/commit/82ad243d6d6be97e156329103dd245102d579c7b))
* Update all deps. ([281c2b7](https://github.com/bscotch/stitch/commit/281c2b77d82db954beffa2df4412dbafc32c2738))



# [2.9.0](https://github.com/bscotch/stitch/compare/v2.8.0...v2.9.0) (2021-05-19)


### Bug Fixes

* Can now accomodate the object collision event, which deviates from the normal naming convention. ([cad43f7](https://github.com/bscotch/stitch/commit/cad43f72cec301d4d8291de0edb7cd1f563cf6f2))
* Object event files don't always have a name pattern ending in a digit, so it doesn't make sense to represent them with data structures that expect that. ([d10c1b7](https://github.com/bscotch/stitch/commit/d10c1b77d7ee4493156a28756f8de24f5f972e82))
* The 'name' field of frame data in Sprite yy files has a new position in the latest GMS2 IDE. This means that Stitch makes noisy Git histories by making file changes that aren't strictly necessary (note that fixing this will *add* noise for older IDEs). ([cf902ba](https://github.com/bscotch/stitch/commit/cf902ba41b0910703e2783551adde27406f4d156))
* The bounding box mode for new sprites is set to Automatic, which makes for unexpected outcomes when someone opens said sprite in GMS2 (since GMS2 may suddently change the bounding box). Manual is a better default. ([4d1cfcf](https://github.com/bscotch/stitch/commit/4d1cfcfa583dcdeb8311414b196cc5ca3fa8b023))
* When new sprites are added, the right and bottom bbox values are always being set based on the image height/width. They should default to their current value and be auto adjusted if the image size has changed. ([93bd8a3](https://github.com/bscotch/stitch/commit/93bd8a3080bab3d987b61490d476ba7303022c60))
* **Linter:** Parsing single quotes can now properly handle escaped quotes. ([6deb7b7](https://github.com/bscotch/stitch/commit/6deb7b744b183099f180320a6ed25f63cdaba113))
* The function-reference finder should check for the suffix within the reference function name itself. ([07915e7](https://github.com/bscotch/stitch/commit/07915e7ccaaf8ebb96bd238a0c8f4e83f5655e7d))


### Features

* **CLI:** Add the lint command. ([0b66436](https://github.com/bscotch/stitch/commit/0b66436c67d9c78c079694e18aa82b707a7cd82a))
* Add ability for Object resources to return their code (from all events), and for token searches to include that code. ([9732406](https://github.com/bscotch/stitch/commit/97324060cdd55c7019785f2a1b0a02e82d623b62))
* Add caching to Script objects so that they only need to retrieve code from disk once. ([43cbaad](https://github.com/bscotch/stitch/commit/43cbaad155f5f799cb0894d1dc743fee671523f6))
* Add function info getter to the Script class, allowing discovery ([ac7f696](https://github.com/bscotch/stitch/commit/ac7f696d0d3f9e9da3f88f9b7f057badd3c6f9ee))
* Add Linter class to run linting methods and provide output format options. (Needs work.) ([312679c](https://github.com/bscotch/stitch/commit/312679c4a9b42b70f6f4a92977f5b0b8e03c7656))
* Add options to the function-reference-finder to allow/blocklist functions by name. ([5574564](https://github.com/bscotch/stitch/commit/5574564d8f1a43f2aa0ab7f8b68da1ea210b081b))
* Add utilily functions for parsing GML for function names and references. ([26097c0](https://github.com/bscotch/stitch/commit/26097c07175a6caac6bc2db44c69411589a9d041))
* Extract the comparison of two token-locations' position to be a standalone API so that we can compare raw GMLs that are not hosted inside a resource. ([3e7560e](https://github.com/bscotch/stitch/commit/3e7560e9bcffd581f4bd01918b94113ac4e1ed88))
* Have GML token objects use class instances instead to make downstream functionality easier. (Tests are broken.) ([f1bec07](https://github.com/bscotch/stitch/commit/f1bec0765ce6e3b2f951927f552d3f7a8d40e4c8))
* Have Script instances add their name and type to the location info of their globalFunctions getter. ([c9b6f0f](https://github.com/bscotch/stitch/commit/c9b6f0f092ab36c9702a6bf3afda4ff37f5d8ea2))
* Have the function-finder function include position of the function name token, allowing comparision with reference objects for exact matches by location. ([3e9f23b](https://github.com/bscotch/stitch/commit/3e9f23bb5cbead5408b60614c88c4ffda781eb1a))
* Strip string content and comments out of GML prior to parsing for function names and matching tokens against code. ([3148907](https://github.com/bscotch/stitch/commit/31489073f5b1c3337bb5ca9b7882630c8ae8e372))
* Update all deps. ([a8da8a4](https://github.com/bscotch/stitch/commit/a8da8a43bc6dbab5073de0cb4126f52f67c10529))



# [2.8.0](https://github.com/bscotch/stitch/compare/v2.7.13...v2.8.0) (2021-04-22)


### Bug Fixes

* Stitch's GMS2-style JSON format uses LF instead of CRLF for newlines, creating some annoying version diffing problems. ([edf1b19](https://github.com/bscotch/stitch/commit/edf1b19071f85a1f7cab1fa25eab3811fff9212f))


### Features

* Allow the centralized file-writer to force EOL style. ([988e9be](https://github.com/bscotch/stitch/commit/988e9be0763c5ce321f267982f9c1a2fef748166))
* Have script GML written to file with Windows-style EOL. ([34a7746](https://github.com/bscotch/stitch/commit/34a7746ca2acc1a644c6ee6328662664142c80d2))
* Update all dependencies to latest. ([c079929](https://github.com/bscotch/stitch/commit/c079929642c75e8933e8805207c8e6f403538a92))



## [2.7.13](https://github.com/bscotch/stitch/compare/v2.7.12...v2.7.13) (2021-04-13)



## [2.7.12](https://github.com/bscotch/stitch/compare/v2.7.11...v2.7.12) (2021-04-13)



## [2.7.11](https://github.com/bscotch/stitch/compare/v2.7.10...v2.7.11) (2021-04-13)


### Bug Fixes

* Installation instructions in the README refer to 'stitch' as 'gms2'. Closes [#24](https://github.com/bscotch/stitch/issues/24). ([394a0a7](https://github.com/bscotch/stitch/commit/394a0a7fca49d0f29cf38b6b1934de96770b784c))


### Features

* Update all dependencies. ([4c0d233](https://github.com/bscotch/stitch/commit/4c0d23361293b061f4bd7e89db9ece433e28a261))



## [2.7.10](https://github.com/bscotch/stitch/compare/v2.7.9...v2.7.10) (2021-03-01)


### Features

* Reset thumbnail on Spine sprite update to trigger cache refresh. ([28873ff](https://github.com/bscotch/stitch/commit/28873ff999c36f4cd72c00856b47772e93b4f97e))
* Update all dependencies. ([60896a1](https://github.com/bscotch/stitch/commit/60896a1208a66f5d337de85428c122226a41a570))



## [2.7.9](https://github.com/bscotch/stitch/compare/v2.7.8...v2.7.9) (2021-02-09)


### Bug Fixes

* Sequence 'length' is now properly updated to match the number of frames. This stopped getting updated at some point, causing GMS to think that the sprites had only one frame. ([2a6d59f](https://github.com/bscotch/stitch/commit/2a6d59fa100a437963d0fef23ef388bffe7cd5cf))



## [2.7.8](https://github.com/bscotch/stitch/compare/v2.7.7...v2.7.8) (2021-02-09)



## [2.7.7](https://github.com/bscotch/stitch/compare/v2.7.6...v2.7.7) (2021-02-09)



## [2.7.6](https://github.com/bscotch/stitch/compare/v2.7.5...v2.7.6) (2021-02-08)


### Bug Fixes

* The KeyframeIds are now recycled when sprites are updated, keeping the Git history cleaner. ([0a3d99e](https://github.com/bscotch/stitch/commit/0a3d99efc63bb46605dbf85d47e9c3c747d358f4))



## [2.7.5](https://github.com/bscotch/stitch/compare/v2.7.4...v2.7.5) (2021-02-08)


### Bug Fixes

* Copying a file now ensures that the target path is clobbered if it already exists. ([d338404](https://github.com/bscotch/stitch/commit/d3384045f0f3f2b56fde7f670365116b3335a77b))



## [2.7.4](https://github.com/bscotch/stitch/compare/v2.7.3...v2.7.4) (2021-02-08)


### Bug Fixes

* The Key field in the sprite yy files now starts at 0 instead of 1. ([bb0ea4e](https://github.com/bscotch/stitch/commit/bb0ea4e39b6e881822306bdc72df70737f245ea1))


### Features

* All CLI commands now include a --debug option to add extra logging. ([c463a3a](https://github.com/bscotch/stitch/commit/c463a3a95c0ff22abcdedeac329c8e08d3842c8f))



## [2.7.3](https://github.com/bscotch/stitch/compare/v2.7.2...v2.7.3) (2021-02-08)


### Bug Fixes

* The 'Key' field in sprites' yy file is now incrementing as expected. ([95b4ce3](https://github.com/bscotch/stitch/commit/95b4ce3806edbc84b6427274d8795957cd1e0521))



## [2.7.2](https://github.com/bscotch/stitch/compare/v2.7.1...v2.7.2) (2021-02-08)



## [2.7.1](https://github.com/bscotch/stitch/compare/v2.7.0...v2.7.1) (2021-02-08)


### Bug Fixes

* Spine sprite imports now fully clean up after themselves. ([23deada](https://github.com/bscotch/stitch/commit/23deadab558be602243aa81d053a97b2bf3bcdfa))
* Spine sprites are now *actually imported correctly*. The previous claims were all lies. ([240e2e8](https://github.com/bscotch/stitch/commit/240e2e85ce254426d6bcfce36310e415055e3238))
* Spine sprites are now being correctly imported. Spine imports were ([159d7e7](https://github.com/bscotch/stitch/commit/159d7e71f8fd305c4c5788f5b5260db1ef2b44d0))
* The config key names for platform versions no longer throw an error with the latest Typescript version. ([6254520](https://github.com/bscotch/stitch/commit/62545205333e673d008262c18d6d61620fcd909d))


### Features

* Room assets are now typed, paving the way for manipulating rooms ([9e00a22](https://github.com/bscotch/stitch/commit/9e00a224447291dcb78c98af055957d41fbe13fa))
* Stitch can now be used to add object instances to existing rooms. ([b1f2397](https://github.com/bscotch/stitch/commit/b1f2397b4387382a3dbac89dcdc89eddc89dee81))



# [2.7.0](https://github.com/bscotch/stitch/compare/v2.6.1...v2.7.0) (2021-02-03)


### Features

* On sprite import, name postfixes can now be added. ([a2d6559](https://github.com/bscotch/stitch/commit/a2d655942ccbcf216d84d901fbebde9a784bd5fc))



## [2.6.1](https://github.com/bscotch/stitch/compare/v2.6.0...v2.6.1) (2021-02-03)


### Features

* Thrown errors will now use the Typescript source maps for their traces. ([e29f67a](https://github.com/bscotch/stitch/commit/e29f67a4521c75c60ad610244da70a1960577a16))
* When importing over an existing sprite, Spritely will recycle the existing frameIds to reduce the clutter in git commit history. ([d124f07](https://github.com/bscotch/stitch/commit/d124f075ecce6a689c3275e08897ca38fb4173db))



# [2.6.0](https://github.com/bscotch/stitch/compare/v2.5.1...v2.6.0) (2021-02-02)


### Bug Fixes

* Import of spine sprites no longer throws errors. ([d150267](https://github.com/bscotch/stitch/commit/d150267298843fed79206203c181f67d88d60488))
* The latest IDE changed the YYP 'RoomOrder' field to 'RoomOrderNodes' with a different data structure. The types no longer scream at you as a consequence, but this will need a more general solution for long-term stability. ([ad13be8](https://github.com/bscotch/stitch/commit/ad13be8a7a4f41fa415609a00f86aa71fb9d938a))


### Features

* Batch sprite imports now detect if sprites are Spine exports and imports them as well. ([6542288](https://github.com/bscotch/stitch/commit/65422885b8e40116bc73acbb2dc2a1cb8dd3a7c3))
* Sample Spine resources are now included for developing spine imports. ([cb0a8bf](https://github.com/bscotch/stitch/commit/cb0a8bf10d990cb0715dac8b379699473d684106))
* The Project class now includes a private method for importing Spine sprites. ([0f3e6fe](https://github.com/bscotch/stitch/commit/0f3e6fecb0f81c0ebfdf81c2d9ca0d1b64bb9812))



## [2.5.1](https://github.com/bscotch/stitch/compare/v2.5.0...v2.5.1) (2021-02-01)



# [2.5.0](https://github.com/bscotch/stitch/compare/v2.4.0...v2.5.0) (2021-02-01)


### Bug Fixes

* Test requests to the Bscotch website are no longer failing after a change to the server started blocking certain kinds of requests. ([e69c61d](https://github.com/bscotch/stitch/commit/e69c61d1b33be20f5f344b01c0de20a15072e6cd))



# [2.4.0](https://github.com/bscotch/stitch/compare/v2.3.0...v2.4.0) (2021-01-28)


### Bug Fixes

* All CLI calls are broken due to breaking change in underlying 'commander' dependency. ([7b37f08](https://github.com/bscotch/stitch/commit/7b37f08350ce83b60d73a209637a93325747c485))


### Features

* Sprite batch-imports now allow for excluding by sprite name, using a regex pattern. This is useful when the sprite source contains images that are not intended to be imported as sprites. ([ea05dd8](https://github.com/bscotch/stitch/commit/ea05dd8c3b11d70aad4911f186e6aead77f0cf2d))



# [2.3.0](https://github.com/bscotch/stitch/compare/v2.2.1...v2.3.0) (2020-12-08)


### Bug Fixes

* Included file import now serves warning instead of error when the ([df68d6a](https://github.com/bscotch/stitch/commit/df68d6a3ca7417cf99b911447ff302f71db666f8))



## [2.2.1](https://github.com/bscotch/stitch/compare/v2.2.0...v2.2.1) (2020-12-02)


### Bug Fixes

* On merge, Stitch no longer overwrites files that are unchanged. This should reduce GameMaker crashes during merges. ([caa5b37](https://github.com/bscotch/stitch/commit/caa5b37453f6d88a84eebfd16145fdbf837c5a95)), closes [#20](https://github.com/bscotch/stitch/issues/20)



# [2.2.0](https://github.com/bscotch/stitch/compare/v2.1.2...v2.2.0) (2020-11-28)


### Features

* Merging a GitHub repo now allows using the latest tagged commit, without requiring a pattern to match against. This dramatically simplifies the most common use case of wanting to merge the most recent release of something. ([ce0e1bf](https://github.com/bscotch/stitch/commit/ce0e1bf7e28f647ec93e48cadcd3e5f2effc2b9c))



## [2.1.2](https://github.com/bscotch/stitch/compare/v2.1.0...v2.1.2) (2020-11-28)


### Bug Fixes

* GitHub revision and tagPatterns are no longer being ignored. ([de7e121](https://github.com/bscotch/stitch/commit/de7e121e08544f98c1347491f3ca372d5de5721d))



# [2.1.0](https://github.com/bscotch/stitch/compare/v2.0.0...v2.1.0) (2020-11-28)


### Features

* Downloading/unzipping now includes console logs, since it can take a while for large projects and feedback is useful. ([1053cb9](https://github.com/bscotch/stitch/commit/1053cb9d9f149fddb25f0daa21a3f462436f25ea))
* Env-var loading now includes a helper specifically for GitHub tokens. ([8bbe9f6](https://github.com/bscotch/stitch/commit/8bbe9f6310c921a79b4e611ebd7e66e2b0f395cf))
* Merging from GitHub and URL are now separate methods in the Gms2Project class, allowing them to be used programmatically. In addition, when fetching from GitHub a GITHUB_PERSONAL_ACCESS_TOKEN env var is loaded (if found) to use as API credentials, allowing access to private repos. ([c8fe701](https://github.com/bscotch/stitch/commit/c8fe70132b6cd7a0987fa24f8155573e497982ca))
* The HTTP getter now allows for setting headers, so that credentials can be passed for accessing private GitHub repos. ([c05090d](https://github.com/bscotch/stitch/commit/c05090d40eb8f6cb5619fb238a7e60bb9e676cc5))
* The Stitch library now includes an environment variable load that searces in HOME and CWD for whitelisted variable names in env files named .env, .stitch.env, or stitch.env. This will allow future features, like storing GitHub credentials for accessing private repos for project merges. ([4e4378a](https://github.com/bscotch/stitch/commit/4e4378ace0789b8baf6676740ee26faad8b732da))



# [2.0.0](https://github.com/bscotch/stitch/compare/v1.5.0...v2.0.0) (2020-11-28)


### Features

* 'import' CLI commands are now called 'add' for clarity, and several CLI options have been shorted for better legibility and easier typing. BREAKING. ([d77369f](https://github.com/bscotch/stitch/commit/d77369f00d76c035647dac840c8773f19f5e455f))
* The old 'module' concept has been removed and placed with more understandable 'project merge'. APIs, CLIs, and docs have all been updated to reflect the changes. BREAKING. ([c69c661](https://github.com/bscotch/stitch/commit/c69c661d4c2f51cc4f7c15fe27e98d8f7d9d97da))



# [1.5.0](https://github.com/bscotch/stitch/compare/v1.4.0...v1.5.0) (2020-11-27)


### Features

* Assets can now be imported from other projects by remote URL, such as from Github. ([e13ad5b](https://github.com/bscotch/stitch/commit/e13ad5be98f18ebad17acba0dc56a64ac9de2578))
* Importing modules now allows importing *all* assets from one project into another. This also required adding and exposing new import options to control what happens with conflicts. ([a2455b4](https://github.com/bscotch/stitch/commit/a2455b4cbfaa47e0badb5ddb8270001e24bd853b))
* Stitch library now includes method to download and extract a remote zip file. This will be required for direct module imports from remote GameMaker projects. ([295cacd](https://github.com/bscotch/stitch/commit/295cacd15cef425fb5e69c7cdea3b2cbec1c52fa))
* The Stitch library now contains a general HTTP(S) getter. This sets the stage for downloading remote projects for module import. ([be255ff](https://github.com/bscotch/stitch/commit/be255ff7bcdc52524edebaedca2944c92f5f3c32))



# [1.4.0](https://github.com/bscotch/stitch/compare/v1.3.1...v1.4.0) (2020-11-24)


### Bug Fixes

* The sound channel and compression getter and setter now use ([c9663e7](https://github.com/bscotch/stitch/commit/c9663e746ddafe930527323186a4b55cf23fa947))


### Features

* Can set the channel and compression of sound resources. ([4920008](https://github.com/bscotch/stitch/commit/4920008464d8037aee9f9e8bfb8ee2ca4315a6b3))



## [1.3.1](https://github.com/bscotch/stitch/compare/v1.3.0...v1.3.1) (2020-11-23)


### Bug Fixes

* The track keyframe 'Key' and 'Length' fields in Sprite yy files now render as single-decimal-precision numbers. ([d1f223c](https://github.com/bscotch/stitch/commit/d1f223c6d173905936688d7a689af656c65c9378))



# [1.3.0](https://github.com/bscotch/stitch/compare/v1.2.0...v1.3.0) (2020-11-17)


### Features

* A new NumberFixed class, also used by jsonify, allows numbers with single-decimal precision. This can be used to reduce yy file changes, since GameMaker writes some numbers in this way. ([9ba711a](https://github.com/bscotch/stitch/commit/9ba711a232cfd87db7b175cb1ff7276f914f519f))
* Sprites now load and save some numbers using single-decimal numbers, matching GameMaker's output. This reduces meaningless Git history changes. ([d5dbde6](https://github.com/bscotch/stitch/commit/d5dbde6cf00c59d89f399777c9cb264f3f3859c1))
* The base resource class now allows for data transformations on load, so that plain JSON sources can be used to create more complex types. ([5fc8182](https://github.com/bscotch/stitch/commit/5fc81820d8161b22ccfb5f308041692b3d9e0162))



# [1.2.0](https://github.com/bscotch/stitch/compare/v1.1.4...v1.2.0) (2020-11-16)


### Features

* Classes now use 'toJSON()' instead of getter 'dehydrated', since toJSON() is a native part of JavaScript. Breaking. ([44bce97](https://github.com/bscotch/stitch/commit/44bce97151a31bc02cd8ccfb9c0d2651e26c1614))
* Write JSON without sorting keys and with tabs as two spaces, to reduce Git conflicts with GameMaker's output format. ([ae09c69](https://github.com/bscotch/stitch/commit/ae09c69c5c2e47f7a225b6421f590b93f19c3f90))
* yy and yyp files are now saved in GMS2-style JSON. The CLI 'jsonify' command has been removed, as it is no longer needed. BREAKING. ([59dda95](https://github.com/bscotch/stitch/commit/59dda952399173d7a5414ae8bc630ec21777444a))



## [1.1.4](https://github.com/bscotch/stitch/compare/v1.1.3...v1.1.4) (2020-10-26)



## [1.1.3](https://github.com/bscotch/stitch/compare/v1.1.2...v1.1.3) (2020-10-26)


### Bug Fixes

* The running IDE will no longer require a restart when doing an import. ([d62b573](https://github.com/bscotch/stitch/commit/d62b573e859d935783b0dd61bffcb9161acdad63))



## [1.1.2](https://github.com/bscotch/stitch/compare/v1.1.1...v1.1.2) (2020-10-26)



## [1.1.1](https://github.com/bscotch/stitch/compare/v1.1.0...v1.1.1) (2020-10-26)



# [1.1.0](https://github.com/bscotch/stitch/compare/v1.0.0...v1.1.0) (2020-10-26)


### Features

* Error names have been changed to 'Stitch...' from 'Gms2Pipeline...'. BREAKING. ([8dd0c1d](https://github.com/bscotch/stitch/commit/8dd0c1d6dcd768a9fc08e44359e061e6f2c1cc3f))
* File-writing now first deletes the target file and then writes, since the GMS2 IDE handles that better than writing over existing files. ([a552e88](https://github.com/bscotch/stitch/commit/a552e8859843d80ac76bcdb4f8bea4c83db8f765))



# [1.0.0](https://github.com/bscotch/stitch/compare/v0.11.0...v1.0.0) (2020-10-26)


### Features

* Options for adding included files are now bundled into an options object to simplify the API. BREAKING. ([ab77489](https://github.com/bscotch/stitch/commit/ab774891bfefa7b2421a871b114e13dac474412d))
* The CLI set subcommands for texture and audio groups are no longer plural, since that was confusing. BREAKING. ([92dbbb8](https://github.com/bscotch/stitch/commit/92dbbb8d1df86087e07ab968094e9364c8fa5ced))
* The Sound class now allows setting properties such as bitrate, sample rate, and channels. ([7b4488a](https://github.com/bscotch/stitch/commit/7b4488a6bab1694e20b2f06b9ae2c9b0a9e7e8dd))



# [0.11.0](https://github.com/bscotch/stitch/compare/v0.10.0...v0.11.0) (2020-10-20)


### Features

* Included files can now be deleted programmatically. ([cb62c84](https://github.com/bscotch/stitch/commit/cb62c843018161f5a98519a4baae5435c548ad58))



# [0.10.0](https://github.com/bscotch/stitch/compare/v0.9.5...v0.10.0) (2020-10-19)


### Features

* GMS2 Objects now have typings. Only some events are typed since there are many and there is no current use case for most. ([bfa3762](https://github.com/bscotch/stitch/commit/bfa37626d4146238351742e5a7e0d74fcde520c1))
* Module imports now fail if module objects are not self-contained (all associated sprites and parent objects must also be in the imported modules). ([1eb62f1](https://github.com/bscotch/stitch/commit/1eb62f1e0ec104ab5a1228355cfe0453bdc14438))
* Objects can now be programmatically added to projects. ([39d5518](https://github.com/bscotch/stitch/commit/39d5518ccef968ef709b25208d7b24ccb0f1bb24))
* The prefix for console logs is now STITCH (instead of GMS2) and colors are improved. ([bf36e73](https://github.com/bscotch/stitch/commit/bf36e73c4b3ee6c933d4e6fddab616518b66b7fc))



## [0.9.5](https://github.com/bscotch/stitch/compare/v0.9.4...v0.9.5) (2020-10-16)


### Features

* Imports now provide some simple console logging, mostly so you know that things are happening. ([8805cbf](https://github.com/bscotch/stitch/commit/8805cbfed3d5cedcee2a2f74002939209cce7997))



## [0.9.4](https://github.com/bscotch/stitch/compare/v0.9.3...v0.9.4) (2020-10-16)


### Features

* Error messages whose source project might be ambiguous during a module import now include the project they came from. ([26bb105](https://github.com/bscotch/stitch/commit/26bb105b264f55d171a39d2fc1d360f6c22a5414))



## [0.9.3](https://github.com/bscotch/stitch/compare/v0.9.2...v0.9.3) (2020-10-14)


### Bug Fixes

* The --force option now works on the setter CLI commands. Closes [#13](https://github.com/bscotch/stitch/issues/13). ([3e3a619](https://github.com/bscotch/stitch/commit/3e3a619a1e11720036a14344814ed3498ad88f7f))



## [0.9.2](https://github.com/bscotch/stitch/compare/v0.9.1...v0.9.2) (2020-10-14)


### Features

* Confirmation messages will now appear in the console upon import of sprites, sounds, files, and scripts. ([8ce29e0](https://github.com/bscotch/stitch/commit/8ce29e00c148cc2fb5952bf1f64751303668b191))



## [0.9.1](https://github.com/bscotch/stitch/compare/v0.9.0...v0.9.1) (2020-10-14)


### Bug Fixes

* The sprite import argument --flatten no longer requires a parameter, since that doesn't make any sense. ([5bba50e](https://github.com/bscotch/stitch/commit/5bba50ebe8d0eb87025b2b1012b71188bf56b20e))



# [0.9.0](https://github.com/bscotch/stitch/compare/v0.8.3...v0.9.0) (2020-10-14)


### Features

* Batch-importing sprites now allows options to prefix sprite names, enforce casing requirements, and flatten source folders into the sprite name. ([8683c24](https://github.com/bscotch/stitch/commit/8683c24a19c3dfa1227f596a02853403b2654a2c))



## [0.8.3](https://github.com/bscotch/stitch/compare/v0.8.2...v0.8.3) (2020-10-14)


### Bug Fixes

* Querying Switch version in the absence of the nmeta file now throws ([9fcb2a7](https://github.com/bscotch/stitch/commit/9fcb2a74bc86759a93a5b548c66cc72ba7776afc))


### Features

* Setting and getting versions now supports xbox and switch. ([07cd9e8](https://github.com/bscotch/stitch/commit/07cd9e80a532d7de0ac692ea4068677fe1f0c683))
* The sample project now has Switch metadata file. ([1839a22](https://github.com/bscotch/stitch/commit/1839a22394ea523ac5d92cc318741725c96ce0ea))



## [0.8.2](https://github.com/bscotch/stitch/compare/v0.8.1...v0.8.2) (2020-10-13)


### Bug Fixes

* The --force option will no longer be stripped from CLI commands. The options normalizer no longer whitelists fields, making it easier to add command options. ([aa85185](https://github.com/bscotch/stitch/commit/aa8518525e9506393560170f88a6238f56cf68a4))



## [0.8.1](https://github.com/bscotch/stitch/compare/v0.8.0...v0.8.1) (2020-10-13)



# [0.8.0](https://github.com/bscotch/stitch/compare/v0.7.0...v0.8.0) (2020-10-13)


### Features

* All CLI commands now include a --force option, for those who want to live dangerously. ([e1a959d](https://github.com/bscotch/stitch/commit/e1a959d07ffafe3a0d895a7127bcdec1a9b7aa3f))
* CLI 'assign' commands are now under the 'set' command, since the distinction isn't obvious. ([33c8593](https://github.com/bscotch/stitch/commit/33c85932e8780aa80cfe2b592e83fa44db71531f))



# [0.7.0](https://github.com/bscotch/stitch/compare/v0.6.5...v0.7.0) (2020-10-13)


### Features

* Add 'id' getter to base resource class. IDs are frequently used in other contexts, so being able to easily fetch them is useful. ([584a8d9](https://github.com/bscotch/stitch/commit/584a8d9f066a88366a22f2fa579d22bd6e978361))
* Add EmptyArray utility type. Gamemaker files frequently have arrays that are always empty, and this type is needed to properly document that. ([9928a54](https://github.com/bscotch/stitch/commit/9928a54ef65ec970778aa4225411e058c2418e86))
* Add path methods for getting the subdirectory name for a given directory. ([5d01b7f](https://github.com/bscotch/stitch/commit/5d01b7f3396d8eba3318cd13870d7ceca2abb329))
* Add Sharp as a dependency for any needed image manipulation and metadata gathering in preparation for adding sprite import functionality. Create sample subimage sources for experimenting with how GMS2 sprite import works, and to use in downstream tests. Begin drafting sprite subclass methods for creating sprites from images. ([43c5550](https://github.com/bscotch/stitch/commit/43c5550dfb055984ddc927f62ffe80b986bdb19a))
* Add UUID module with an enum for storing UUID5 namespace constants. ([b816486](https://github.com/bscotch/stitch/commit/b816486fc9c5782ccd248ab9da9b267890be39ee))
* Complete draft of methods to create new Sprite yy files. ([c95500e](https://github.com/bscotch/stitch/commit/c95500e997e57790b480771931dd8bf82e19f9a5))
* Fully type Sprite YY file contents. ([baa3a6c](https://github.com/bscotch/stitch/commit/baa3a6c23868cc1bcd6f6e0cd1f58d74cd2a59d8))
* Stitch now includes a method for batch importing sprite assets ([b5504b7](https://github.com/bscotch/stitch/commit/b5504b7bd555051dd5ed88a0e92ad207f43ae3d5))
* The CLI now includes an import sprites command. ([a8d6b3d](https://github.com/bscotch/stitch/commit/a8d6b3d822c8af9d1dc0dd71282fcc8ffcfb2ae7))
* Use the EmptyArray type of all always-empty arrays in Sprite YY files, and create objects for all the constant values inside Sprite YY files to make building them from scratch easier. ([046143a](https://github.com/bscotch/stitch/commit/046143a17a1a244d1fb6fa7fa7a2dcbcef501b5f))



## [0.6.5](https://github.com/bscotch/stitch/compare/v0.6.4...v0.6.5) (2020-10-12)


### Bug Fixes

* The precommit hook for converting all files to JSON will no longer be installed, as it destablizes the Gamemaker IDE. ([d561436](https://github.com/bscotch/stitch/commit/d561436195edb0872e43da4d63833cea7aebb65c))
* Update set version cli's unit test to also use `projectVersion` ([82f301a](https://github.com/bscotch/stitch/commit/82f301a46b7e2f5531a0b69db687c7b144516b0a))
* Update the version CLI command to parse the correct argument. ([f8d6296](https://github.com/bscotch/stitch/commit/f8d62968b2199856961f7f58dd01000776b1412b))
* Update the version setter to only target *.yy files in the options ([7e1831e](https://github.com/bscotch/stitch/commit/7e1831ed0b63a5a121856d1b8eb4e6817a3e3bcd))


### Features

* Stitch will now only save yy(p) files if there has been a meaningful change. This reduces the file structure conflicts between Gamemaker and Stitch. ([3371304](https://github.com/bscotch/stitch/commit/3371304ed5004c8136fd55a283b64034026f41de))



## [0.6.4](https://github.com/bscotch/stitch/compare/v0.6.3...v0.6.4) (2020-10-08)


### Bug Fixes

* Warnings for yy(p) files that cannot be converted to JSON only include the parent path. ([efaf00a](https://github.com/bscotch/stitch/commit/efaf00ac7edcc8d786565b27665c8160d8406c8b))



## [0.6.3](https://github.com/bscotch/stitch/compare/v0.6.2...v0.6.3) (2020-10-08)


### Features

* Ensure that the .git and node_modules folders are excluded from recursive path lookups. ([eb1abd4](https://github.com/bscotch/stitch/commit/eb1abd4d88032b52bd70bef2c0eab9d3464d1508))



## [0.6.2](https://github.com/bscotch/stitch/compare/v0.6.1...v0.6.2) (2020-10-08)


### Features

* Allow forcing the deborkifier command to bypass the requirement of being in a clean git working directory. ([c398a95](https://github.com/bscotch/stitch/commit/c398a954d30677976f9228bb3a1f2fc096d7960b))
* On project save, also run the jsonify converter on all yy files in the project. ([ff0aaa1](https://github.com/bscotch/stitch/commit/ff0aaa1fd0fa4cbc03b78298c518607cd6d4fc9d))



## [0.6.1](https://github.com/bscotch/stitch/compare/v0.6.0...v0.6.1) (2020-10-08)


### Bug Fixes

* The package-lock is out of date and causes minor errors during git commits. ([f7ab46d](https://github.com/bscotch/stitch/commit/f7ab46d62defc23138460d471172ff3b33ddb6e1))



# [0.6.0](https://github.com/bscotch/stitch/compare/v0.5.0...v0.6.0) (2020-10-08)


### Features

* Add 'debork' CLI command that loads and saves a project, which will fix common issues, install any hooks, and normalize the file contents as plain JSON. ([a58bd35](https://github.com/bscotch/stitch/commit/a58bd35fd03be80c2466c34fa69a6da0dd973924))
* Have the jsonify script log a warning instead of throw an error when the yy/p file is not valid JSON. ([0c276da](https://github.com/bscotch/stitch/commit/0c276da5240e0a19777aa5dabaec7b607d534c4a))



# [0.5.0](https://github.com/bscotch/stitch/compare/v0.4.0...v0.5.0) (2020-10-06)


### Features

* Rename CLI command to 'stitch' instead of 'gms2'. ([7a388b8](https://github.com/bscotch/stitch/commit/7a388b816a503e9b4d85299333ae67a086b3befe))



# [0.4.0](https://github.com/bscotch/stitch/compare/v0.3.5...v0.4.0) (2020-10-06)


### Bug Fixes

* Add sanity check for audio import's absolute path. ([6b76979](https://github.com/bscotch/stitch/commit/6b76979a29723f775f1cfb1a074359fd2ee28524))
* Change CLI parsed inputs to use camel case. ([69044c1](https://github.com/bscotch/stitch/commit/69044c10608fd66f4c0989f273db79c97a67d6c0))
* Change Jsonify CLI function to call the appropriate methods based ([5dfad08](https://github.com/bscotch/stitch/commit/5dfad08df591e0e075d83d9d91c2a626293793ea))
* Change the import included files unit test to be recursive. ([9c2fefe](https://github.com/bscotch/stitch/commit/9c2fefe4b195767792873f228ef1b8bcf155fbf4))
* CLI batch import sounds now recursively discovers file in the given ([e2b4d0e](https://github.com/bscotch/stitch/commit/e2b4d0eeec06f37a839e25c6650373c7cc08ab17))
* Do not allow group assignments at the root level (for texture and audio groups). Close [#6](https://github.com/bscotch/stitch/issues/6) ([e4b959c](https://github.com/bscotch/stitch/commit/e4b959cb68d96107a27eaa073b748cd1a4e0536d))
* Don't allow resource folder assignments to root level. Close [#5](https://github.com/bscotch/stitch/issues/5). ([ceb3177](https://github.com/bscotch/stitch/commit/ceb3177ad8a3dace69489af26fde83f4c47e053a))
* Ensure included files are added to the correct project path. ([8f32eb4](https://github.com/bscotch/stitch/commit/8f32eb4577ea0dc0244fc0a993998741738ae2be))
* Ensure that creating new resources will put them in the correct ([9afda76](https://github.com/bscotch/stitch/commit/9afda765bd3e4fbd2ca54eb61d79ecb4a59a552a))
* Ensure that import sounds and files CLI functions work when no ([425dcda](https://github.com/bscotch/stitch/commit/425dcda08984aada7b3042a394e36355f8b9c95a))
* Removed the redundant static resourceRoot variable in ([ef34119](https://github.com/bscotch/stitch/commit/ef34119417cb10901946874253c165fe795ac888))
* Some parts of the README are unclear. ([30bd0a5](https://github.com/bscotch/stitch/commit/30bd0a5fa3b99d87cd29063b4b99250e663aff14))
* The header markup in the README does not render well on GitHub. ([8b8faa7](https://github.com/bscotch/stitch/commit/8b8faa7c590d54fb278bd6b2ba233fc2a66ffac2))
* Update CLI unit tests to allow using relative paths. ([c08da4f](https://github.com/bscotch/stitch/commit/c08da4fff89ccc98f265fe100c77e36cf246f5b6))
* Update folder assignment to handle root level resources. ([ebad310](https://github.com/bscotch/stitch/commit/ebad31005b1698746dedd5eee21dbbbe569df22e))


### Features

* Add batch sound import function and unit test. ([522e310](https://github.com/bscotch/stitch/commit/522e3106cc841d6a393f383e7e95a50c3b6de7a4))
* Add CLI command for importing modules and corresponding unit test. ([9dc1210](https://github.com/bscotch/stitch/commit/9dc121036fd2decd1de1d9cce355ef1598e4419b))
* Add CLI commands for assigning texture and audio groups and their ([6350afa](https://github.com/bscotch/stitch/commit/6350afaedd097483898b79765ced16789cd3eb53))
* Add import sounds CLI function and unit tests. ([fcf3058](https://github.com/bscotch/stitch/commit/fcf3058ed9c3d6e9df28d8a6a30a3d8129ab991c))
* Add set version CLI command and smoke unit test. ([8462709](https://github.com/bscotch/stitch/commit/8462709538e89ebc6998f27affbb4fe677eb2dff))
* Add the import file CLI command. ([94dda7c](https://github.com/bscotch/stitch/commit/94dda7c1e176cdb635575c7266c6dc405c66954e))
* Add unit tests for CLI success cases for jsonify and module ([a1c7271](https://github.com/bscotch/stitch/commit/a1c7271a98e60907ed850571e7dc31f81878f82f))
* Add version display to the help text of the CLI main command. ([6d59522](https://github.com/bscotch/stitch/commit/6d59522cebfce318e854a2afb812a61a1c5bd6bd))
* Allow addIncludedFiles function to filter target files by ([ee92eb6](https://github.com/bscotch/stitch/commit/ee92eb6a0530155e31f30943cfd5b7a5fdb0d98f))
* Change name from 'GMS2 PDK' to 'Stitch'. Much more fun this way, and also easier to remember and talk about. (The CLI command will also need to be renamed.) ([57959c6](https://github.com/bscotch/stitch/commit/57959c66236368fc571190f0a3d571f842d1a5a6))



## [0.3.5](https://github.com/bscotch/stitch/compare/v0.3.4...v0.3.5) (2020-09-22)


### Features

* Remove the deleteFiles method on Resources, since that allows deletion of files without de-referencing from the YYP file. Move that logic into the ResourceArray instead. ([f70ae46](https://github.com/bscotch/stitch/commit/f70ae46c0490ca8a095de3e3dd63b7fa79d46150))



## [0.3.4](https://github.com/bscotch/stitch/compare/v0.3.3...v0.3.4) (2020-09-21)


### Features

* Only check the Git working directory if not bypassing that check. ([0d316e9](https://github.com/bscotch/stitch/commit/0d316e95a8be49b1510992e0dbfea71bd8bea03b))



## [0.3.3](https://github.com/bscotch/stitch/compare/v0.3.2...v0.3.3) (2020-09-21)


### Features

* Provide (dangerous) bypass option so that the requirement to be in a clean Git repo can be skipped when that is needed (e.g. for testing/development) ([4ad30cc](https://github.com/bscotch/stitch/commit/4ad30cc4f1943c84e12fd85da21e63ed0afcefc2))



## [0.3.2](https://github.com/bscotch/stitch/compare/v0.3.1...v0.3.2) (2020-09-21)


### Bug Fixes

* Script assets are not converted to new Script objects when loading a project. ([90357d2](https://github.com/bscotch/stitch/commit/90357d2b0b055af159a238d6d75e6932b228a8fc))


### Features

* Create template subclasses for all resource types so that they can be populated at any time without the developer having to remember to register that subclass with the ResourceArray. ([fa5e5c0](https://github.com/bscotch/stitch/commit/fa5e5c025ecf99fab4dbc3efa392553a4d43c5d3))
* When trying to load JSON, throw a descriptive error when the file content is NOT json. ([fa3fea1](https://github.com/bscotch/stitch/commit/fa3fea1a8b12f2d5600707256be82f55d81f3384))



## [0.3.1](https://github.com/bscotch/stitch/compare/v0.3.0...v0.3.1) (2020-09-21)


### Bug Fixes

* The version setter throws invalid format errors with completely valid version strings. ([675f56d](https://github.com/bscotch/stitch/commit/675f56dcc36bbc326fc355dff5b6f913e2f761da))



# [0.3.0](https://github.com/bscotch/stitch/compare/v0.2.1...v0.3.0) (2020-09-21)


### Features

* Add ability to delete a resource. ([f0b2bca](https://github.com/bscotch/stitch/commit/f0b2bca48834f1b7d10a602c6305dc15821d45e3))



## [0.2.1](https://github.com/bscotch/stitch/compare/v0.2.0...v0.2.1) (2020-09-21)


### Bug Fixes

* When calling the 'addScript' method, the script is always added even if one already exists by the same name. Should create the script if new, else update its code. ([ef4782c](https://github.com/bscotch/stitch/commit/ef4782cc64aa2ae3abb9021d6f51c638f1b49de4))



# [0.2.0](https://github.com/bscotch/stitch/compare/v0.1.2...v0.2.0) (2020-09-21)


### Features

* Create Script class and add method to Projects for creating new ([d9baefe](https://github.com/bscotch/stitch/commit/d9baefe576d723686337b1433abad5f2e317a0ad))



## [0.1.2](https://github.com/bscotch/stitch/compare/v0.1.1...v0.1.2) (2020-09-18)


### Bug Fixes

* Type files are not being included in the published npm package for the index file. ([12c5d55](https://github.com/bscotch/stitch/commit/12c5d55ea34f2e5adc9c1826e4d2feaf3aa85809))


### Features

* Add default export of the Gms2Project class to the index. ([a68dfa6](https://github.com/bscotch/stitch/commit/a68dfa6e486db09fc64330911eafecd9f1f4fc23))



## [0.1.1](https://github.com/bscotch/stitch/compare/v0.1.0...v0.1.1) (2020-09-18)


### Bug Fixes

* **Versioning:** Changelogs are being created before versioning, causing them to be one version behind reality. ([ed90f79](https://github.com/bscotch/stitch/commit/ed90f7943f7eab1da9af8588f44852bae976c0a6))



# [0.1.0](https://github.com/bscotch/stitch/compare/8240278735d87cd1c7576773622c5b2ee368d1ae...v0.1.0) (2020-09-18)


### Bug Fixes

* Add configvalues field to each type that uses it in the yyp types. ([c8f0162](https://github.com/bscotch/stitch/commit/c8f0162ef57ef4b06bb39f5c2c52c8873422b4a9))
* Fix the precommit git hook's indentation and file permission issue. ([5b95a6f](https://github.com/bscotch/stitch/commit/5b95a6f5b006e1c53f629fa9023775ebdc323c3c))
* IncludedFiles are not being imported due to not being discovered as members of a 'module'. ([9565c35](https://github.com/bscotch/stitch/commit/9565c35d2aa7d795a9e12b008e452d261b5a434a))
* Remove circular dependency between gms2 resource and its ([c07e56e](https://github.com/bscotch/stitch/commit/c07e56ed6887e7ffeb070fddf32eefd0411246d9))
* Stage the pre-commit hook changes before commiting. ([09034f1](https://github.com/bscotch/stitch/commit/09034f180b239716c1e85dd4fe0ac795b89ba208))
* Throws an error if git is not available. ([2a66bad](https://github.com/bscotch/stitch/commit/2a66badf5b5e402e343a029772f01b5704b520b2))
* Upserts of existing audio create new instead of updating existing. ([67ca37c](https://github.com/bscotch/stitch/commit/67ca37cc0c539370337008d18199f8e28b691b29))


### Features

* Add .toObject() method to main Gms2Project class. ([76a8d81](https://github.com/bscotch/stitch/commit/76a8d81a0a5c5486d5a6bebf1a5289da9b2aa124))
* Add 'RoomOrder' class and refactor general structure of Gms2Project component classes to be much simpler by using the initial vanilla object as a privately stored data value. ([75068ee](https://github.com/bscotch/stitch/commit/75068eeae627fd14d0d1f1fa7899713535377c87))
* Add a Gms2FolderArray subclass of Gms2ComponentArray so that folders-specific features can be added. In the new class, add a method to return the list of folders making up a 'module'. ([36b7814](https://github.com/bscotch/stitch/commit/36b7814c627126cc29e3209ceb02cad3d59e0f14))
* Add a Sound resource subclass and get the subclass selector typings working. ([d8d0f9a](https://github.com/bscotch/stitch/commit/d8d0f9ab717eb2ec6946fee8d94c1c1171673adc))
* Add ability to import files as IncludedFiles, starting with ([5184c48](https://github.com/bscotch/stitch/commit/5184c48784d822752ac019665aa6f2f290a559c5))
* Add ability to import new IncludedFiles. ([8e2bd0a](https://github.com/bscotch/stitch/commit/8e2bd0a55bee8e051156a9e74ca4a0249438b1e7))
* Add ability to upsert sounds into a project. ([ed08b47](https://github.com/bscotch/stitch/commit/ed08b47963414e4306437feb10a6fbb390ce872a))
* Add CLI command for 'jsonifying' yy and yyp files (convert Gamemaker's project files into standard JSON). ([660ed75](https://github.com/bscotch/stitch/commit/660ed75a3f9f94b7e62992cf53c0ff38d811250c))
* Add code for installing pre commit hook to run jsonify. ([899a267](https://github.com/bscotch/stitch/commit/899a267aba6d74d42c14b85c21b7af001736abc7))
* Add generic "assert" that throws custom ([9605627](https://github.com/bscotch/stitch/commit/96056278604be3f2827b13b27c60e6ab7eef647d))
* Add generic file manipulation methods to the new Storage class, and add typing to the Sound resource's .yy file information. ([8981909](https://github.com/bscotch/stitch/commit/898190997f5a774f9a04c1dab4136acf0f9f897a))
* Add generically-typed 'find'-related utility methods to the Gms2ResourceArray class. ([63c6d86](https://github.com/bscotch/stitch/commit/63c6d8614e4cc51a8b050445faf9d7ceb7f9fa43))
* Add IncludedFile class. ([07da501](https://github.com/bscotch/stitch/commit/07da50183782653e1608f731e4841c2edeccacbd))
* Add method for adding configs to a project. ([e0c940c](https://github.com/bscotch/stitch/commit/e0c940c49a67fd6cf8bcf3f1cc473ec147dd3f91))
* Add method to create folders (requires testing). ([9891fd2](https://github.com/bscotch/stitch/commit/9891fd2bf34aadd680dcc47902b6a0887f08f262))
* Add methods for ensuring that any Audio or Texture Groups listed in the config exist in the project. ([151aa4f](https://github.com/bscotch/stitch/commit/151aa4f0f2116dd0f779a9efa25c70703638be1b))
* Add methods to set the version number inside all options files, and to get the version from any given target platform. ([be62681](https://github.com/bscotch/stitch/commit/be62681d6e67b83efe96b57852a84fb49485ad98))
* Add methods to the Resource Class to get the resource type. ([983e18d](https://github.com/bscotch/stitch/commit/983e18d653c3364cbc6fb82bb7a0dd150eed4818))
* Add module imports. ([c5fd5b8](https://github.com/bscotch/stitch/commit/c5fd5b8f0072140cb5d784c1596fa828b06a070e))
* Add optional 'content' parameter to IncludedFile import, allowing creating IncludedFiles using data (strings, buffers, or arbitrary Javascript structures) instead of files. ([dac69b4](https://github.com/bscotch/stitch/commit/dac69b4b5b301d91f7a44feface5fa12e029d031))
* Add requirement that the project have a clean Git working directory in order to use the PDK. This will make it far less likely that someone will break their project in an unrecoverable way. ([d57013f](https://github.com/bscotch/stitch/commit/d57013f4d4b6a129523837cd449c35323a1e7bcc))
* Add Resource class. ([f6b71ef](https://github.com/bscotch/stitch/commit/f6b71ef81e46e4d4fb3c23e36f0c24687ed48fa1))
* Add static create() method to Resource class, for creating subclasses based on type. ([01922aa](https://github.com/bscotch/stitch/commit/01922aaf551c883dd50d7efc8e1c7e0237c7395e))
* Add Texture Group and Audio Group assignment methods. ([ef349bb](https://github.com/bscotch/stitch/commit/ef349bb3763ee8db99b6138d7abb81a1f825efb4))
* Add TextureGroup and AudioGroup classes. ([93216fc](https://github.com/bscotch/stitch/commit/93216fc60d3cdc01e0c9f0c786bcd96f23dde993))
* Begin framing out a new Gms2Project class, based on the old Project class. ([48a4694](https://github.com/bscotch/stitch/commit/48a4694fcb42be332f78e0502322edf9fe007d22))
* Begin populating a Gms2ProjectComponents interface by extending ([e5dbd8d](https://github.com/bscotch/stitch/commit/e5dbd8d81db6fb43aba0a74010a423077b1b1d2b))
* Chang the project name from 'Pipeline SDK' to 'Pipeline Development Kit (PDK)'. ([29c5496](https://github.com/bscotch/stitch/commit/29c5496bc30ff2c3e2be85a983c009cd47aef68e))
* Change replacer in custom JSON stringifier to attempt to call .toObject() on each value. This allows class instances to control how they are stringified, by optionally implementing that method. ([b4ad948](https://github.com/bscotch/stitch/commit/b4ad948b2b542d55a464c95f8d224e0dad880482))
* Change the dehydrate class method to a getter called dehydrated ([e5ff063](https://github.com/bscotch/stitch/commit/e5ff0637406533a28ff04f25577aa2ac2e89e301))
* Create class for Folders. ([8ac345a](https://github.com/bscotch/stitch/commit/8ac345a7a3ac8124be4306bd637db49cc05f64d0))
* Create project config class for centralizing handling of configuration data, in particular for texture page and audio group assignments. ([b9339d3](https://github.com/bscotch/stitch/commit/b9339d3c39e53e29f479ca1726429a93923d1fce))
* Draft typings for Sprite .yy files. ([4f41f17](https://github.com/bscotch/stitch/commit/4f41f174893af3ab0fcdd1c25c84c7004efc49c0))
* Ensure any configurations used by imported resources exist in the target project. ([01ed967](https://github.com/bscotch/stitch/commit/01ed9675136c592046ec38d57af926c49c7a1cce))
* Ensure that new/updated sounds and sprites have the texture pages and audio groups they came with added to the current project. ([341d2ba](https://github.com/bscotch/stitch/commit/341d2ba0b7461448e87f854bb3010f8c068819a9))
* Fix bugs preventing dehydration from resulting in the same data as the original yyp file ([2cf0bf0](https://github.com/bscotch/stitch/commit/2cf0bf0e2fdefed94bb7dd4f3c51e8f40880d64e))
* Have IncludedFiles be included in imported modules. ([da37277](https://github.com/bscotch/stitch/commit/da37277ec4625430f26d0e5bbd428bb7702289c4))
* Have lists of Audio Group and Texture Group folders sorted by specificty to simplify making assignments. ([046bdf4](https://github.com/bscotch/stitch/commit/046bdf469060a0452afbeb58389ddf90a7078bae))
* Limit file system methods to a whitelist, instead of everything in fs-extra, so that we must explicitly ensure that any included method will work as expeted with Gamemaker files. ([fd4ffb2](https://github.com/bscotch/stitch/commit/fd4ffb24bb8b120124b5349a13a5c6792d5b7c0a))
* Populate useful file- and folder-management methods. ([5406516](https://github.com/bscotch/stitch/commit/540651605c2b4f852e9e04f9d45d0f32a346db34))
* Remove legacy code from prior version of this project (for GMS <2.3). ([1fb9801](https://github.com/bscotch/stitch/commit/1fb9801ea82880df1505e5cd3385dcb9d1fe3f25))
* Replace 'toObject' with 'dehydrate' so that the verb is more understanble. Add generic hydration/deydration methods to make code more readable. ([75defd2](https://github.com/bscotch/stitch/commit/75defd2fc4b07a3b2a470ea82d67421ccc982a94))
* Revert 'Objectable' base class dependency. This will complicate downstream requirements and adds very little. ([972800b](https://github.com/bscotch/stitch/commit/972800b5a32d86c98bc5f770cf2400d25b8f24cf))
* When upserting audio/texture groups, only save if actually adding a new one. ([71b3c34](https://github.com/bscotch/stitch/commit/71b3c34a910b3785470f63bf7bd1dbe47e417a78))
* **Samples:** Update sample-project GMS2 content to include one of each type of asset plus various configuration settings. ([8240278](https://github.com/bscotch/stitch/commit/8240278735d87cd1c7576773622c5b2ee368d1ae))



