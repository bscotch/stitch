# Contributing

The projects in the Stitch monorepo are all designed to solve problems we face at [Butterscotch Shenanigans](https://www.bscotch.net) ("Bscotch"). We've made these projects open source so that others facing similar problems can make use of these tools.

## Requesting features and fixes

We already have an infinite list of features and fixes for our own use cases, so we don't have the bandwidth to build (or maintain) stuff that we don't need.

That said, sometimes things are surprisingly easy to address, and other times people suggest features that we hadn't even realized we _also_ wanted! So if there is a feature or fix that you'd like to see in one of the Stitch projects, please [submit an Issue](https://github.com/bscotch/stitch/issues). Just be ready for us to say, "Sorry, we don't have the bandwidth for that!"

## Contributing your own features and fixes

The projects in this repo are fully open and permissively licensed, so you can make your own fork and change things to your heart's content! Keep an eye on the `LICENSE` files, but in general the only things we're reserving all rights on are our logos, trademarks, and sample assets.

You're welcome to submit a Pull Request to get your changes added to this repo, but there are a few things to keep in mind:

- Before setting off to add a feature/fix, submit an Issue describing what you want to do. That way we can provide guidance, in particular whether or not we'd be likely to merge a PR with those changes.
- If you make signficant changes that aren't something that Bscotch will make use of we aren't likely to merge your PR, since we want to avoid the long-term maintainance burden of features we don't use.
- If we don't merge your changes you can still use them yourself!

## Development

### General Requirements

The Stitch projects are primarily written in Node.js, in Typescript, and related web technologies. We primarily develop on Windows, and to a lesser extend Linux.

- [Node.js 18+](https://nodejs.org/en)
- [pnpm 7+](https://adamcoster.com/blog/pnpm-config)
- [Visual Studio Code](https://code.visualstudio.com/) (VSCode), for working on the Stitch for VSCode extension
- Practical knowledge of Node.js, Typescript, and git

### Project Organization

This git repo is set up as a "monorepo", where each project lives inside of the `packages` folder and includes a `package.json` manifest file describing that package's contents.

```
package.json # Root metadata, including depdendencies used by non-project scripts
scripts/ # Scripts for monorepo management
packages/ # Each folder inside here is a "package" (a.k.a. "project")
```

Packages generally have a similar structure:

```
# E.g. the `packages/vscode` project
package.json # Project manifest
dist/ # The output folder for build processes
src/ # Where all of the source code goes
assets/ # Non-code content to ship with the package
scripts/ # Scripts for managing the project (e.g. build scripts)
samples/ # Files used for tests
sandbox/ # Temporary files used for tests
```

You'll also notice that code files are mostly organized in a flat structure, using name infixes to provide information. For example:

```
some-module.ts
some-module.test.ts
some-module.types.ts
```

This provides a few benefits:

- VSCode and other editors can collapse files under other files that share a base name, so you can still display these as if they're in a folder
- Bundling is a pretty common part of the JavaScript build process, which destroys all folder information. This is a big problem for dynamic imports and imports of non-code assets, since the paths in the source wouldn't match the paths in the output. Having a flat file structure prevents that problem completely.
- The filename must provide full context without knowing the name of the parent folder. This makes it easier to figure out what you're looking at in editor tabs and file listings.

### Developing Stitch

This repo uses [pnpm](https://pnpm.io/) for handling builds, both of which accept "filters" to limit operations to a subset of projects, and both of which understand the relationships between projects so that things happen in the right order.

> 📝 While you _can_ open the repo root in your IDE to work on Stitch projects, you'll tend to get better tooling results by opening project folders in separate IDE windows!

To get _all_ Stitch projects ready for development, from the repo root run:

- `npm run setup:pnpm` (if you have Node 16+ installed and don't already have pnpm installed)
- `pnpm install` (install all external dependencies for all projects)
- `pnpm build:all` (build all projects)

To work on a specific project, you can find its name in its `package.json` file and then run:

- `pnpm install --filter=the-package-name...` (installs all dependencies, including those for the other Stitch projects this one depends on)
- `pnpm run -r build --only --filter=the-package-name...` (runs the `build` script from the `package.json>scripts` for the package, including the other Stitch projects it depends on)

For a given project, open up its `package.json` and look at the `"scripts"` section to see the kinds of tasks you'll likely want to run (you'll do this via `pnpm the-script-name`). Common scripts include:

- `build` (complete build of the current project (not including local dependencies))
- `watch` (for active development, rebuilds the project when files change)
- `test` (run tests with Node's built-in test runner)

#### Tests

Tests are `*.test.ts` files next to the code they test, written with `node:test` and `node:assert/strict`. Node runs them directly from the TypeScript source (via [type stripping](https://nodejs.org/api/typescript.html)), so there's no need to build a package before testing it. Workspace _dependencies_ are imported from their built output, though, so build those first (e.g. `pnpm run -r --filter=@bscotch/gml-parser... build`).

To pass extra flags to the test runner, call it directly from a package folder, e.g. `node --test --test-name-pattern="Project" "src/**/*.test.ts"` or `node --test --watch "src/**/*.test.ts"`.

Because Node only _strips_ types, library packages use the stricter [packages/tsconfig.lib.json](packages/tsconfig.lib.json), so that the compiler rejects code that Node can't run:

- Relative imports use the source file's real extension (`./thing.ts`), which `tsc` rewrites to `.js` in the build output.
- Type-only imports must use `import type` (or inline `type` modifiers).
- No enums (use an `as const` object plus a same-named type), namespaces, constructor parameter properties, or decorators (apply decorators explicitly with `tslib`'s `__decorate()`).

Tests must be able to run in CI (the `test` job in the [Release workflow](.github/workflows/release.yaml) runs them on Windows before anything is published, and a failure blocks the release). Tests that need things CI doesn't have (a GameMaker install, interactive prompts, heavy network use) should be skipped there, e.g. with `{ skip: process.env.CI ? 'reason' : false }`. Mark tests for known bugs with `{ todo: 'reason' }` so they run and report without failing the suite.

Also in the `package.json` you'll see the `"dependencies"` for the given project, including local ones (where you see `"workspace:*"` instead of a semver range). Use those to orient yourself towards the other projects you may also need to open and work on.

#### Stitch for VSCode

To work on Stitch for VSCode, you'll need an up-to-date version of [Visual Studio Code](https://code.visualstudio.com/) (development primarily happens on the Insiders version).

Open the `packages/vscode` folder in a new VSCode window, then for your initial setup:

- Run `pnpm install --filter=bscotch-stitch-vscode...` (install all relevant external deps)
- Run `pnpm build:deps` (builds all monorepo projects that this one depends on)

Once everything has been installed and built:

- Run `pnpm watch` (rebuilds whenever you make a change)
- Hit `F5` (or otherwise launch the debugger) to run the extension in a debug environment

## Releasing (maintainers)

Versioning happens locally and publishing happens in CI.

### Commit messages

Version bumps and changelogs are generated from [conventional-commit](https://www.conventionalcommits.org/)-style messages, like `fix: Fixed the thing`. Each paragraph of a commit message that starts with `type: description` (or `type(scope): description`) counts as a separate change. Types determine the bump:

| Types                                          | Bump  | Changelog section |
| ---------------------------------------------- | ----- | ----------------- |
| `feat`, `feature`                              | minor | Features          |
| `fix`, `bug`, `bugfix`, `issue`                | patch | Fixes             |
| `perf`, `performance`, `security`              | patch | Fixes             |
| `docs`, `doc`, `documentation`                 | patch | Docs              |
| `change`, `breaking`, `alt`, or any type + `!` | major | Breaking Changes  |
| anything else (`chore`, `test`, `refactor`…)   | none  |                   |

Each paragraph becomes a single changelog line, so hard-wrapped paragraphs are fine.

A project is affected by a commit if the commit changes files in its `packages/*` folder. If a project's workspace dependencies get bumped, it gets at least a patch bump.

### Bumping versions

On `develop`, with a clean working tree:

```sh
pnpm bump --dry-run # Preview bumps and new changelog entries (works on any branch)
pnpm bump           # Bump, update changelogs, commit, tag, and push
```

`pnpm bump` creates a single `bumped: ...` commit containing the new versions and regenerated changelogs, tags it with `<package>@<version>` for each bumped package, and pushes the commit and tags together. It refuses to run if any `package.json` version is lower than that package's latest tag (e.g. after a merge clobbered a version).

Run `pnpm changelogs` to regenerate changelogs without bumping anything.

### Publishing

Pushing a bump triggers the [Release workflow](.github/workflows/release.yaml), which:

1. Finds the version tags on the pushed commit.
2. Checks each public package's version against `package.json` and npm (it must be newer than npm's `latest`; already-published versions are skipped).
3. Builds and tests the packages to be published, then publishes them to npm (in dependency order) using npm Trusted Publishing.
4. Triggers the Stitch for VSCode publishing workflow if that extension was bumped.

To retry a failed release, run the Release workflow manually with the bump commit's SHA.

Release-script tests: `pnpm test:scripts` and `pnpm typecheck:scripts`.
