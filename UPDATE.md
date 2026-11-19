# Stitch Update

Stitch no longer fully works with the more recent versions of GameMaker we need, so it's time to get things updated!

We'll do that in phases on branch `feat/2026.100.0.1199`. Note that this is a Windows-first project so most of this work should happen _on_ Windows, though ideally anything we do would also work on Linux and Mac (or fail gracefully on those platforms).

## [✅ COMPLETE] Phase 1: Publishing Overhaul

The npm packages in this project are just published by running the `pnpm:bump` script locally.

Publishing locally was never a good idea, but now it's way too finicky since npm changed their approach to auth tokens. So we need to move publishing into CI.

To do this, we should drop the `trebuchet` dependency and reconstruct its necessary features within the project as scripts. Trebuchet is a custom utility for version-bumping and publishing packages in monorepos, and for generating changelogs in the process (via a modified version of Conventional Commits). We should be able to reproduce the parts of that we actually use without all of the baggage of that (very outdated) general-purpose tooling that Trebuchet provides.

The goal is to still be able to simply run `pnpm:bump` to have versioning all happen properly, and changelogs written as expected, and then have actual publishing happen in CI while ensuring tests are passing and builds are complete.

We will not do any test-running or versioning in this phase, we're just getting things ready.

## [✅ COMPLETE] Phase 2: Update test-running

Tests currently depend on Mocha, but Node has its own runner now and can run Typescript files directly, so that makes for a better overall experience. So we should replace Mocha with Node's native runner.

We also need to evaluate the existing test suites for compatibility with CI, and figure out how to get them into a state where they _are_ compatible with CI.

Outcome:

- Mocha/Chai replaced with `node:test`/`node:assert`, running TS source directly. Library packages now extend `packages/tsconfig.lib.json` (erasable syntax only, `.ts` import specifiers, `verbatimModuleSyntax`), which required converting enums, parameter properties, and decorators.
- ⚠️ `@bscotch/yy`'s enums (`SpriteType`, `SoundChannel`, etc.) are now `as const` objects with same-named types. Member access and type usage are unchanged, but numeric reverse lookups (`SpriteType[2]`) and member-as-type (`x: SpriteType.Spine`) no longer work. This is a breaking change, so the next `yy` release must be a major version bump.
- New `.github/workflows/test.yaml` builds and tests all npm libraries (plus release scripts) on Windows for PRs and pushes to `develop`.
- Tests that can't run in CI: the launcher suite (was already fully skipped: needs GameMaker installs and interactive prompts) and the full GameMaker release-notes scrape (skipped when `CI` is set; takes minutes without a local cache).
- Known bug surfaced: the parser keeps a stale struct member after a file is reloaded mid-edit. It was failing under Mocha, and Mocha's `bail` hid the parser tests after it. It's now an isolated `todo` test in `parser/src/project.test.ts` (see Phase 6).
- Not yet verified on Linux/macOS.

## Phase 3: Update Dependencies

It's been a while since the 3rd party dependencies were updated, so it'd be wise to make those updates and make sure all Typescript typechecking continues to work, all existing tests pass, and any new tests are added for related coverage that's missing.

Before updating external dependencies:

- [x] Update Typescript and ensure all typechecks still pass
  - Updated to TypeScript 6.0.3 everywhere. TypeScript 7 (the native Go compiler) doesn't ship the JS compiler API that svelte-check and typescript-eslint need, and no svelte-check release supports it yet. Revisit once the tooling catches up. TS 7 will remove options TS 6 deprecates, and this repo no longer uses any of them.
  - Minimal in-major bumps for official TS 6 support: `@sveltejs/kit` ^2.70.4, `svelte-check` ^4.7.8, `@typescript-eslint/*` 8.73.
  - Fixed type errors that predated the update: a stale gcdata import in `cl2-editor`, a too-narrow `rangeFrom()` parameter in `vscode` (the parser now exports `IRange`), and `$props<T>()` generics in the webviews. The webviews' props were untyped until now because svelte-check silently treated them as `any`.
  - Note: ESLint 9 needs a flat `eslint.config.*`, which the repo doesn't have (only the legacy `.eslintrc.cjs`), so linting is currently non-functional.
- Update Svelte and other deps used by the Stitch for VSCode webviews, ensuring they still work within the extension
- Identify any external dependencies that could be replaced by either better dependencies (smaller, more stable, better supported, etc) or, even better, dependencies that could be completely removed and replaced with native Node modules and/or local code.

## Phase 4: Ensure Compatibility with new GameMaker

We need support for GameMaker IDE 2026.100.0.1199 and runtime 2026.100.0.1133:

- Obtain sample files from that IDE version and add to the test suite
- Update Yy schemas so they work with the new files
- Check [the Issues](https://github.com/bscotch/stitch/issues) for any related compatibility issues we missed

## Phase 5: Publish!

In Phase 1 we won't have _actually_ published anything so those changes will have gone untested. But now we'll have stuff to publish, so we can do so while debugging any problems with the new publishing approach.

Before the first CI publish, set up npm Trusted Publishing for each public package. On npmjs.com, go to the package's Settings → Trusted Publisher → GitHub Actions and enter:

- Organization/user: `bscotch`
- Repository: `stitch`
- Workflow filename: `release.yaml`
- Environment: none

Packages:

- [ ] `@bscotch/gamemaker-releases`
- [ ] `@bscotch/gcdata`
- [ ] `@bscotch/gml-parser`
- [ ] `@bscotch/sprite-source`
- [ ] `@bscotch/steam-bbcode`
- [ ] `@bscotch/stitch-config`
- [ ] `@bscotch/stitch-launcher`
- [ ] `@bscotch/yy`

Once everything publishes successfully through CI, consider setting each package's "Publishing access" to disallow token-based publishing.

## Phase 6: Miscellaneous updates

While we're at it, it would be good to resolve any other low-hanging fixes/features from [the Issues](https://github.com/bscotch/stitch/issues) and look into what it would take to handle other wishlist items.

Known bugs to fix:

- [ ] **Parser: stale struct members after a mid-edit reload.** Reloading a file with `reloadDirty` (as happens while editing) leaves members from the previous content on the type. E.g. reloading `Complicated.gml` with `function Tmp () constructor {a}` and then `{ab}` leaves `a` as a member of `Tmp`'s `self` type. Reproduced by the `todo` test "removes stale members when a file is reloaded mid-edit" in `packages/parser/src/project.test.ts`. Once fixed, remove its `todo` option.
