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
- The Release workflow's `test` job builds and tests all npm libraries (plus release scripts) on Windows at the release commit, and blocks all publishing if anything fails. (This replaced a standalone `test.yaml` workflow, so PRs are no longer tested in CI.)
- Tests that can't run in CI: the launcher suite (was already fully skipped: needs GameMaker installs and interactive prompts) and the full GameMaker release-notes scrape (skipped when `CI` is set; takes minutes without a local cache).
- Known bug surfaced: the parser keeps a stale struct member after a file is reloaded mid-edit. It was failing under Mocha, and Mocha's `bail` hid the parser tests after it. It's now an isolated `todo` test in `parser/src/project.test.ts` (see Phase 6).
- Not yet verified on Linux/macOS.

## Phase 3: Update Dependencies

It's been a while since the 3rd party dependencies were updated, so it'd be wise to make those updates and make sure all Typescript typechecking continues to work, all existing tests pass, and any new tests are added for related coverage that's missing.

Before updating external dependencies:

- [x] Update to Typescript 6 and ensure all typechecks still pass
- [x] Fix the ESLint config so that a single root config works for all packages, and address all linting errors.
  - Replaced the three legacy `.eslintrc.cjs` files (and `.eslintignore`) with one root flat `eslint.config.js` covering TS, JS, and Svelte (site + webviews). All ESLint deps now live only in the root `package.json`. Run with `pnpm lint` (or `pnpm lint:fix`).
  - `pnpm lint` reports 0 errors and 0 warnings. Fixes were mostly unused vars, un-awaited promises (`void`, or `await` where it mattered), `{#each}` keys, `resolve()` for internal site links, and adding reasons to `@ts-expect-error`s.
  - Not in CI yet: the test workflow only installs the npm libraries, but linting needs the site/webview/extension deps too.
- [x] Update Svelte and related deps used by the Stitch for VSCode webviews, the site package, and anywhere else
- [ ] Evaluate switching the Stitch for VSCode extension from building .cjs to using actual modules (supported since [1.100](https://code.visualstudio.com/updates/v1_100))

After these are complete, update the remaining dependencies and ensure all tests continue to pass.

- [x] Audit all external dependencies: replace with native Node/local code where possible, else swap for a better package, else update.
  - **Replaced with native/local code:** `node-fetch`, `axios` (global `fetch`), `uuid` (`crypto.randomUUID()`), `type-fest` (local `PartialDeep` exported from `@bscotch/yy`), `dotenv` (`process.loadEnvFile()`), `inquirer` (`node:readline/promises`), `citty` (`node:util` `parseArgs`), `zx`/`del`/`rimraf` (`node:fs/promises`, via `scripts/clean.mjs`), `concurrently` (pnpm's regex script selector). Unused `glob` and `tslib` (in packages not using `__decorate`) were removed.
  - **Swapped:** `xml2js` → `fast-xml-parser` (output verified identical across 34 GmlSpec files); `image-js` → `fast-png` + a small local `Raster` (output verified pixel-identical across all PNG formats). ⚠️ Behavior change: sprite-source now treats images without alpha as fully opaque when cropping (image-js used the last color channel as if it were alpha).
  - **Updated** everything else to latest, except: TypeScript stays at 6.0.3 (typescript-eslint, svelte-check, and Kit don't support 7 yet), `@types/vscode` matches `engines.vscode` (1.107), and `spine-player` stays on 4.2.x to match the Spine editor version.
  - **Node 22 is the baseline** (VSCode's embedded runtime): `@types/node` ^22, CI and `.npmrc`'s `use-node-version` on 22.x, and `engines.node: ">=22"` on published libraries. Under Node 22 `node --test` defaults to the TAP reporter when not in a TTY.
  - `gcdata`'s `build:types` output changes shape under `json-schema-to-typescript` 16 (`oneOf` branches are intersected with shared properties). The code supports both shapes, but the generated `cl2.types.auto.ts` was not regenerated, since doing so also pulls in unrelated Crashlands2 data changes.

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
