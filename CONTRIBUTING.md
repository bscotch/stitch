# Contributing

The projects in the Stitch monorepo are all designed to solve problems we face at [Butterscotch Shenanigans](https://www.bscotch.net) ("Bscotch"). We've made these projects open source so that others facing similar problems can make use of these tools.

## Requesting features and fixes

We already have an infinite list of features and fixes for our own use cases, so we don't have the bandwidth to build (or maintain) stuff that we don't need.

That said, sometimes things are surprisingly easy to address, and other times people suggest features that we hadn't even realized we *also* wanted! So if there is a feature or fix that you'd like to see in one of the Stitch projects, please [submit an Issue](https://github.com/bscotch/stitch/issues). Just be ready for us to say, "Sorry, we don't have the bandwidth for that!"

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

This repo uses [Turborepo](https://turbo.build/) and [pnpm](https://pnpm.io/) for handling builds, both of which accept "filters" to limit operations to a subset of projects, and both of which understand the relationships between projects so that things happen in the right order.

> 📝 While you *can* open the repo root in your IDE to work on Stitch projects, you'll tend to get better tooling results by opening project folders in separate IDE windows!

To get *all* Stitch projects ready for development, from the repo root run:

- `npm run setup:pnpm` (if you have Node 16+ installed and don't already have pnpm installed)
- `pnpm install` (install all external dependencies for all projects)
- `pnpm turbo run build` (build all projects)

To work on a specific project, you can find its name in its `package.json` file and then run:

- `pnpm install --filter=the-package-name...` (installs all dependencies, including those for the other Stitch projects this one depends on)
- `pnpm turbo run build --only --filter=the-package-name...` (runs the `build` script from the `package.json>scripts` for the package, including the other Stitch projects it depends on)

For a given project, open up its `package.json` and look at the `"scripts"` section to see the kinds of tasks you'll likely want to run (you'll do this via `pnpm the-script-name`). Common scripts include:

- `build` (complete build of the current project (not including local dependencies))
- `watch` (for active development, rebuilds the project when files change)
- `test` (run tests on built output)
- `test:dev` (run tests in dev mode, typically disabling parallization and timeouts)

Also in the `package.json` you'll see the `"dependencies"` for the given project, including local ones (where you see `"workspace:*"` instead of a semver range). Use those to orient yourself towards the other projects you may also need to open and work on.

#### Stitch for VSCode

To work on Stitch for VSCode, you'll need an up-to-date version of [Visual Studio Code](https://code.visualstudio.com/) (development primarily happens on the Insiders version).

Open the `packages/vscode` folder in a new VSCode window, then for your initial setup:

- Run `pnpm install --filter=bscotch-stitch-vscode...` (install all relevant external deps)
- Run `pnpm build:deps` (builds all monorepo projects that this one depends on)

Once everything has been installed and built:

- Run `pnpm watch` (rebuilds whenever you make a change)
- Hit `F5` (or otherwise launch the debugger) to run the extension in a debug environment
