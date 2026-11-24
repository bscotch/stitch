# Stitch Update

Branch `feat/2026.100.0.1199` updates Stitch for GameMaker IDE 2026.100.0.1199 (runtime 2026.100.0.1133), moves publishing into CI, and overhauls the tooling, dependencies, and Stitch Launcher. What's left is getting it released, then follow-ups.

This is a Windows-first project, but anything we do should ideally also work on Linux and macOS (or fail gracefully there).

## After the release

- [ ] Smoke-test Stitch for VSCode against a real project in GameMaker 2026.100.0.1199 (open project, set version, Igor build, prune IDE cache).
- [ ] Stitch for VSCode is temporarily published to the Pre-Release channel. Once verified, remove `--pre-release` from its `package` and `vscode:publish` scripts and bump again (the stable version must be higher than the pre-release).
- [ ] Review potentially-closed Issues: #303, #306, #309
- [ ] Delete the `VSCE_PAT` repo secret.

## Issues to close once the parser overhaul is published

The overhaul (branch `parser-overhaul`) replaces `@bscotch/gml-parser` with `gml-syntax`, `gml-formatter`, `gamemaker-project`, `gml-analysis`, and (in Phase 5) a language server used by Stitch for VSCode. Once that's published, these can be closed. Items marked _(Phase 5)_ also depend on work planned for Phase 5.

- [ ] [#307](https://github.com/bscotch/stitch/issues/307) Macro configuration overrides: `gml-syntax` parses `#macro Config:NAME value`, and the analysis treats it as another definition of the same macro.
- [ ] [#300](https://github.com/bscotch/stitch/issues/300) Undeclared AudioEffect symbols: the analysis now loads the spec's `Enumerations` (which the old parser skipped), so `AudioEffectType`, `AudioLFOType` and the `Struct.AudioEffect` members resolve.
- [ ] [#284](https://github.com/bscotch/stitch/issues/284) Incorrect warning on `Constructor.staticVar`: functions and constructors have static structs, so static variables can be accessed through them (and completed after `Constructor.`), and `func.staticVar` works for regular functions too.
- [ ] [#200](https://github.com/bscotch/stitch/issues/200) No signature help for static methods called with dot notation: those calls now resolve to the method, so they get signature help.
- [ ] [#178](https://github.com/bscotch/stitch/issues/178) Utility type for static structs: `static_get(target)` (and the `StaticType<T>` utility type) resolve to the function's or constructor's static struct.
- [ ] [#155](https://github.com/bscotch/stitch/issues/155) Enum member values in hovers: members' values are computed (from literal values, counting up from the previous member) and shown on hover, e.g. `Enum.Alarm.cooldown = 6`.
- [ ] [#91](https://github.com/bscotch/stitch/issues/91) Check function argument types: new `argument-type` warning for arguments whose type clearly doesn't match the parameter's (e.g. a string where a number is expected). Can be turned off.
- [ ] [#259](https://github.com/bscotch/stitch/issues/259) Inline warning suppression: `// @stitch-ignore: code1, code2` at the end of a line, or `// @stitch-ignore-next-line` (optionally with codes) on the line before. Without codes, all diagnostics on the line are suppressed.
- [ ] [#202](https://github.com/bscotch/stitch/issues/202) Warnings for missing documentation: new optional `missing-docs` diagnostic for global functions, constructors, enums, macros and variables. _(Phase 5: a setting to turn it on.)_
- [ ] [#293](https://github.com/bscotch/stitch/issues/293) EMFILE errors in large projects: project files are now read with bounded concurrency (in both `gamemaker-project` and `gml-analysis`).
- [ ] [#292](https://github.com/bscotch/stitch/issues/292) `project.getGmlFile()` only accepting a Pathy: obsolete. The new packages identify files by plain strings (project-relative paths), and `@bscotch/gml-parser` will be deprecated.
- [ ] [#211](https://github.com/bscotch/stitch/issues/211) Missing object event names: every event type is supported (keyboard, gesture, async, etc., with generated labels for those without a known one), and the table now includes all user events and alarms. _(Phase 5: shown in the asset tree.)_
- [ ] [#236](https://github.com/bscotch/stitch/issues/236) Can't create collision events, and their names are invisible: `gamemaker-project` creates, deletes, renames and labels collision events. _(Phase 5: the extension UI.)_
- [ ] [#280](https://github.com/bscotch/stitch/issues/280) Collision event management in VSCode: as for #236. _(Phase 5: the extension UI.)_
- [ ] [#291](https://github.com/bscotch/stitch/issues/291) Prefabs break project discovery. _(Phase 5: skip `.yyp` files in prefab folders and in folders of other projects.)_
- [ ] [#294](https://github.com/bscotch/stitch/issues/294) Crash when the GameMaker project isn't the workspace root. _(Phase 5: find projects in subfolders and handle errors loading them.)_
- [ ] [#308](https://github.com/bscotch/stitch/issues/308) Alternative runtime installation path: the analysis takes the GmlSpec paths it's given. _(Phase 5: a setting for extra runtime/spec locations.)_

Also fixed by the overhaul (not a GitHub issue): stale struct members after a mid-edit reload. The old parser's `todo` test ("removes stale members when a file is reloaded mid-edit" in `packages/parser/src/project.test.ts`) goes away with the old package. The new analysis re-derives members from scratch on every change, and its tests check that results after edits match a fresh analysis.

## Follow-ups

- [ ] Resolve issue [#311](https://github.com/bscotch/stitch/issues/311)
- [ ] See if [#296](https://github.com/bscotch/stitch/issues/296) needs to (and can) be resolved
- [ ] Verify the Stitch Launcher and test suites on Linux and macOS (implemented but untested).
- [ ] Evaluate switching the Stitch for VSCode extension from building .cjs to using actual modules (supported since [1.100](https://code.visualstudio.com/updates/v1_100)).
- [ ] Replace the deprecated `on:` event directives in `packages/vscode/webviews/src/lib/Search.svelte` (Svelte warns on every build).
- [ ] Regenerate `gcdata`'s `cl2.types.auto.ts` (its shape changes under `json-schema-to-typescript` 16 and it will pull in unrelated Crashlands2 data changes).
- [ ] Upgrade to TypeScript 7 once typescript-eslint, svelte-check, and SvelteKit support it.
- [ ] Resolve other low-hanging fixes and features from [the Issues](https://github.com/bscotch/stitch/issues).
