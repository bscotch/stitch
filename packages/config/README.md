# Stitch Config

[Stitch](https://github.com/bscotch/stitch) is a collection of tools for managing [GameMaker](https://gamemaker.io) projects, developed by [Butterscotch Shenanigans](https://www.bscotch.net/).

Stitch projects make use of some shared libraries and resources. This package provides schemas and utilities to help manage the `stitch.config.json` file, which lives alongside a GameMaker project's `.yyp` file and is used for configuration of various Stitch features.

The `stitch.config.json` file is used for configuration options that:

- Are specific to the project (i.e. not general configuration)
- Must be followed by all collaborators on that project
- Are not machine-dependent nor user-dependent

It should therefore be tracked in your project's Git history.

## Usage

### Programmatic

You can import the schemas from the main entrypoint:

```ts
import { stitchConfigSchema } from '@bscotch/stitch-config';
```

And a few GameMaker project-management functions from the 'projects' entrypoint:

```ts
import {
  findProjectConfigPath,
  ensureProjectConfig, // Initialize a config file
  loadProjectConfig,
  saveProjectConfig,
  applyGroupAssignments, // Apply texture group and audio group assignments from a config to its project
} from '@bscotch/stitch-config/project';
```

### CLI

If you install globally you can use the CLI via `stitch-config`. Otherwise you can call it in a local install with `npx stitch-config`.

- `stitch-config init <yypFile>`: Ensure a Stitch config file exists for the target project
- `stitch-config sync-groups <yypFile>`: The Stitch config allows specifying audio and texture group assignment rules. This command updates the sprites and sounds to follow those rules.
