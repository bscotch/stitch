# @bscotch/gamemaker-project Changelog

## 1.1.0 (2026-11-24)

### Features

- The gamemaker-project package can now tell real projects apart from prefabs and nested .yyp files found by a search (classifyYypPaths), and gml-analysis can list the dependencies between a project's assets found in its code (listCodeDependencies), for importing assets between projects.
- The gamemaker-project package can now adopt an asset whose files were written by another tool (adoptAsset), and its updateYy method for changing an asset's yy data in a transaction is now public.
- Added the (unpublished) @bscotch/gamemaker-project package for reading and safely changing GameMaker project files. Disk is treated as the source of truth, changes run as serialized transactions that never overwrite external edits, and external changes (including git pulls) are detected and reported as events.