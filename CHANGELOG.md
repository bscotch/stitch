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



