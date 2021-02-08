#!/usr/bin/env node
import {default as cli } from "commander";
import { oneline } from "@bscotch/utility";
import merge, { Gms2MergeCliOptions } from './lib/merge';
import options from "./lib/cli-options";
import { Gms2ResourceArray } from "../lib/components/Gms2ResourceArray";
import { addDebugOptions } from "./lib/addDebugOption";

cli.description("Merge GameMaker Studio projects.")
  .option(...options.targetProject)
  .option("-s --source <path>", oneline`
    Local path to the source GameMaker Studio 2 project.
  `)
  .option("-g --source-github <repo>", oneline`
    Repo owner and name for a Gamemaker Studio 2 project
    on GitHub in format "{owner}/{repo-name}@{revision}".
    The revision suffix is optional, and
    can be a branch name, a tag, or a commit hash.
    Alternatively, the format "{owner}/{repo-name}?" will
    use the most recent tagged commit.
    Finally, the format "{owner}/{repo-name}?{tagPattern}"
    will use the most recent tagged commit where the tag matches
    the pattern. For example, pattern "^v(\\d+\\.){2}\\d+$" would
    match standard semver tags, like "v1.0.0". If no revision or
    tagPattern is provided, Stitch uses HEAD. To provide
    credentials for private GitHub repos, see the README.
  `)
  .option("-u --source-url <url>", oneline`
    URL to a zipped GameMaker Studio 2 project.
  `)
  .option("--if-folder-matches <pattern...>", oneline`
    List of source folder patterns that, if matched,
    should have all child assets imported (recursive).
    Will be passed to \`new RegExp()\` and tested against
    the parent folder of every source resource.
    Independent from ifNameMatches. Case is ignored.
  `)
  .option("--if-name-matches <pattern...>", oneline`
    List of source resource name patterns that, if matched,
    should have all child assets imported (recursive).
    Will be passed to \`new RegExp()\` and tested against
    the name of every source resource.
    Independent from ifFolderMatches. Case is ignored.
  `)
  .option("--types <type...>", oneline`
    All resource types are included by default. You can
    optionally change to a whitelist pattern and only
    include specific types. Types are:
    ${Object.keys(Gms2ResourceArray.resourceClassMap).join(', ')}
  `)
  .option("--skip-included-files",oneline`
    By default, "Included Files" are also merged if
    they match filters. These can be skipped.
  `)
  .option("--move-conflicting", oneline`
    The target project may have assets matching your
    merge pattern, but that aren't in the source.
    By default these are left alone, which can create some
    confusion about which assets came from which projects.
    Using this flag will cause conflicting target assets
    to be moved into a folder called
    MERGE_CONFLICTS for future reorganization. Only use
    this flag if your source and target projects are using
    unique folder names for their assets.
  `)
  .option("--on-clobber <error|skip|overwrite>", oneline`
    If source assets match target assets by name,
    but those matching assets are not matched by the merge
    options, it's possible that the two assets are not
    the same thing. By default Stitch overwrites anyway.
    You can change the behavior to instead skip importing
    those assets (keeping the target version) or throw an error.
  `, 'overwrite')
  .option("--skip-dependency-check", oneline`
    If an object in your source has dependencies
    (parent objects or sprites) that are *not* being merged,
    import will be blocked. This prevents accidentally importing
    broken assets. If you know that those missing dependencies
    will be found in the target project, you can skip this check.
  `)
  .option(...options.force);
addDebugOptions(cli)
  .parse(process.argv);


merge(cli.opts() as Gms2MergeCliOptions);
