# Contributing <a id="contribute"></a>

We would love to get your contributions to Stitch! This section details our expectations and requirements if you do want to contribute.

## Issues and Suggestions

If you discover bugs or missing features, please post them as GitHub issues. Be extremely detailed and thorough in your explanation of the issue/suggestion and why it's important to address it.

Note that it will not be a high priority for the Bscotch team to address issues and feature that we ourselves don't actively need. To make your own fixes/features, see the next section.

## Contributing Code

The fastest way to get fixes and features into Stitch is to submit them yourself! By forking this repo and making changes, you can have your own version of Stitch that works however you want.

If you want to bring your changes back into the main Stitch repo, you can make a pull request to do so. Note that your code will be under strict requirements to make sure that things don't turn into spaghetti:

+ Code must be fully typed Typescript (no `as any` or `//ts-ignore` unless absolutely necessary).
+ If adding a similar feature to something that already exists, the code must follow a similar pattern and re-use as much existing code as possible (no DRY violations).
+ Names of variables, methods, etc. must be consistent with those already in the project.
+ There must be test cases that cover your changes/additions (see `src/test/index.ts`). We don't require unit tests, just functional tests.
+ The pull request must be git-rebase-able on the HEAD of the `develop` branch without conflict.
+ Commit messages must follow the project conventions (below).

It is likely that we will ask for minor changes to the code before accepting a pull request, to ensure that the code base stays consistent.

## Code Layout

Here's a high-level overview of how this project is set up so that you can
figure out where to make your changes:

+ `src/` contains all Typescript source code
+ `build/` will contain all build code, if you make local builds using the Typescript compiler
+ `sample-assets/` is for images, sounds, and other content for testing import functions
+ `sample-module-source/` is a GMS2.3 project used as a module source for testing module imports
+ `sample-project/` is a GMS2.3 project used as the target for imports and other manipulations in test cases.
+ `sand box/` is a temporary folder created when you run tests, where a copies of the sample-project are made
+ `src/index.ts` is the entry point for the project. It could be changed to export more types and features.
+ `src/test/index.ts` is the entry point for testing.
+ `src/lib/` is the bulk of where all functionality is coded
+ `src/cli` is where CLI-specific code lives
+ `src/lib/Gms2Project.ts` exports the main class shown in this documentation, that is used to create a manipulatable model of GameMaker projects. Project-level and batch-resource operations are exposed by this `Gms2Project` class. You should be able to find your way to any other existing feature of this project by starting with this part of the code.
+ `src/lib/components/` contains classes for modeling the components that appear in a project's `.yyp` file.
+ `src/lib/components/resources/` contains classes for each type of GMS2 resource (e.g. Sprites, Scripts, etc). This is where most core functionality is coded up. At base these classes do nothing but load and save `.yy` files -- functionality is added to them as needed. When adding new functionality, use existing functionality (perhaps from other resource types) as a reference.

## Setting up your development environment

After forking this repo to your own GitHub account
and cloning locally:

+ Open a terminal in the root of this project.
  + Run `npm install`
  + Run `npm run build`
  + Run `npm test`
+ If all tests are passing, you're good to go!

## How to test your code

If you are using Visual Studio Code, you can open
up the debug panel from the sidebar and hit the play
button to run tests. Output will appear in your Debug
Console.

In the debugger dropdown you'll see two options:

1. "Stitch Tests (via `ts-node`)" will directly run
   the Typescript code. This is the easiest way to
   ensure you're testing the code that you see.
2. "Stitch Tests (requires compile)" runs the compiled
   JavaScript. This is the same behavior as running
   `npm test` from the command line. If you are using
   this option, make sure you first compile the code
   so that you guarantee you're testing your actual changes.
3. For manual tests, you'll need to make sure you're
   importing from the `build` directory instead of `src`.

To compile the code into JavaScript, you'll need to run
`npm run build`. Alternatively, you can run the Typescript
compiler in watch mode to re-compile the code every time
you save a change, using `npx tsc -w`.

## Commit conventions

All of your commits must follow the conventions below.
We recommend squashing your commits into one commit per
feature/bugfix, but that isn't required.

We follow the conventional-changelog Angular convention for commit messages,
namely formatting them as `<type>: <subject>` where `type` is one of:

+ feat: A new feature
+ fix: A bug fix
+ refactor: A code change that neither fixes a bug nor adds a feature
+ test: Adding missing or correcting existing tests
+ docs: Documentation only changes
+ perf: A code change that improves performance
+ chore: Changes to the build process or auxiliary tools and libraries such as documentation generation
