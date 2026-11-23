# Stitch Update

Branch `feat/2026.100.0.1199` updates Stitch for GameMaker IDE 2026.100.0.1199 (runtime 2026.100.0.1133), moves publishing into CI, and overhauls the tooling, dependencies, and Stitch Launcher. What's left is getting it released, then follow-ups.

This is a Windows-first project, but anything we do should ideally also work on Linux and macOS (or fail gracefully there).

## Release

See [Releasing](CONTRIBUTING.md#releasing-maintainers) for how bumping and publishing work.

- [ ] Merge into `develop` with a merge commit or rebase, **not a squash**: versions and changelogs come from the individual commit messages.
- [ ] On `develop`, run `pnpm bump --dry-run` and review the planned versions and changelogs. Expected: major bumps for `yy`, `gamemaker-releases`, `stitch-launcher`, `gml-parser`, and Stitch for VSCode.
- [ ] Run `pnpm bump`, then watch the Release workflow. This is the first CI publish, so expect to debug it. To retry, run the workflow manually with the bump commit's SHA (already-published versions are skipped).

## After the release

- [ ] Once publishing through CI works, delete the `VSCE_PAT` repo secret.
- [ ] Smoke-test Stitch for VSCode against a real project in GameMaker 2026.100.0.1199 (open project, set version, Igor build, prune IDE cache).
- [ ] Once publishing through CI works, set each npm package's "Publishing access" to disallow token-based publishing.
- [ ] Stitch for VSCode is temporarily published to the Pre-Release channel. Once verified, remove `--pre-release` from its `package` and `vscode:publish` scripts and bump again (the stable version must be higher than the pre-release).
- [ ] Consider running tests and `pnpm lint` on PRs. CI currently only tests at release time, and linting needs the site, webview, and extension dependencies installed.
- [ ] Review potentially-closed Issues: #303, #306, #309

## Follow-ups

- [ ] **Parser: stale struct members after a mid-edit reload.** Reloading a file with `reloadDirty` (as happens while editing) leaves members from the previous content on the type. E.g. reloading `Complicated.gml` with `function Tmp () constructor {a}` and then `{ab}` leaves `a` as a member of `Tmp`'s `self` type. Reproduced by the `todo` test "removes stale members when a file is reloaded mid-edit" in `packages/parser/src/project.test.ts`. Once fixed, remove its `todo` option.
- [ ] Verify the Stitch Launcher and test suites on Linux and macOS (implemented but untested).
- [ ] Evaluate switching the Stitch for VSCode extension from building .cjs to using actual modules (supported since [1.100](https://code.visualstudio.com/updates/v1_100)).
- [ ] Replace the deprecated `on:` event directives in `packages/vscode/webviews/src/lib/Search.svelte` (Svelte warns on every build).
- [ ] Regenerate `gcdata`'s `cl2.types.auto.ts` (its shape changes under `json-schema-to-typescript` 16 and it will pull in unrelated Crashlands2 data changes).
- [ ] Upgrade to TypeScript 7 once typescript-eslint, svelte-check, and SvelteKit support it.
- [ ] Resolve other low-hanging fixes and features from [the Issues](https://github.com/bscotch/stitch/issues).
