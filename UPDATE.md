# Stitch Update

Stitch no longer fully works with the more recent versions of GameMaker we need, so it's time to get things updated!

We'll do that in phases on branch `feat/2026.100.0.1199`. Note that this is a Windows-first project so most of this work should happen _on_ Windows, though ideally anything we do would also work on Linux and Mac (or fail gracefully on those platforms).

## Phase 1: Publishing Overhaul

The npm packages in this project are just published by running the `pnpm:bump` script locally.

Publishing locally was never a good idea, but now it's way too finicky since npm changed their approach to auth tokens. So we need to move publishing into CI.

To do this, we should drop the `trebuchet` dependency and reconstruct its necessary features within the project as scripts. Trebuchet is a custom utility for version-bumping and publishing packages in monorepos, and for generating changelogs in the process (via a modified version of Conventional Commits). We should be able to reproduce the parts of that we actually use without all of the baggage of that (very outdated) general-purpose tooling that Trebuchet provides.

The goal is to still be able to simply run `pnpm:bump` to have versioning all happen properly, and changelogs written as expected, and then have actual publishing happen in CI while ensuring tests are passing and builds are complete.

We will not do any test-running or versioning in this phase, we're just getting things ready.

## Phase 2: Update test-running

Note: I'll need to switch to Windows at this point since Stitch is primarily run there and not all tests will pass on other platforms.

Tests currently depend on Mocha, but Node has its own runner now and can run Typescript files directly, so that makes for a better overall experience. So we should replace Mocha with Node's native runner.

We also need to evaluate the existing test suites for compatibility with CI, and figure out how to get them into a state where they _are_ compatible with CI.

## Phase 3: Update Dependencies

It's been a while since the 3rd party dependencies were updated, so it'd be wise to make those updates and make sure all Typescript typechecking continues to work, all existing tests pass, and any new tests are added for related coverage that's missing.

Before updating external dependencies:

- Update Typescript and ensure all typechecks still pass
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

## Phase 5: Miscellaneous updates

While we're at it, it would be good to resolve any other low-hanging fixes/features from [the Issues](https://github.com/bscotch/stitch/issues) and look into what it would take to handle other wishlist items.
