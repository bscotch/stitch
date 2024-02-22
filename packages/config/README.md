# Stitch Config

[Stitch](https://github.com/bscotch/stitch) is a collection of tools for managing [GameMaker](https://gamemaker.io) projects, developed by [Butterscotch Shenanigans](https://www.bscotch.net/).

Stitch projects make use of some shared libraries and resources. This package provides schemas and utilities to help manage the `stitch.config.json` file, which lives alongside a GameMaker project's `.yyp` file and is used for configuration of various Stitch features.

The `stitch.config.json` file is used for configuration options that:

- Are specific to the project (i.e. not general configuration)
- Must be followed by all collaborators on that project
- Are not machine-dependent nor user-dependent
