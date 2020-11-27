#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline } from "@bscotch/utility";
import importModules, { ImportModuleOptions } from './lib/import-modules';
import options from "./lib/cli-options";
import { assert, StitchError } from "../lib/errors";

const cli = commander as (ImportModuleOptions & CommanderStatic);

cli.description("Import modules from a source GameMaker Studio 2 project into a target project.")
  .option("-g --source-github <url>", oneline`
    Repo owner and name for a Gamemaker Studio 2 project
    on GitHub in format "{owner}/{repo-name}@version".
    The version suffix is optional, and
    can be a branch name, a tag, or a commit hash.
  `)
  .option("-s --source-project-path <path>", oneline`
    Local path to the source GameMaker Studio 2 project.
  `)
  .option("-u --source-url <url>", oneline`
    URL to a zipped GameMaker Studio 2 project.
  `)
  .option("--modules <names...>", oneline`
    The names of the modules in the source project to import.
    Can be a comma-separated list. Any resources whose folder
    path in the source project resources tree include a provided
    module name as a subdirectory will be imported. If not provided,
    *all* assets are imported by treating root folders as modules.
    In this case, the flags --do-not-move-conflicting and 
    --skip-dependency-check are forced, and it's likely that you'll
    want to set --on-clobber to either 'overwrite' or 'skip'.
  `)
  .option("--skip-dependency-check", oneline`
    If an object in your source modules has dependencies
    (parent objects or sprites) that are *not* in those modules,
    import will be blocked. This prevents accidentally importing
    broken assets. If you know that those missing dependencies
    will be found in the target project, you can skip this check.
  `)
  .option("--do-not-move-conflicting", oneline`
    If the target project already has the source module,
    it may have assets in it that are *not* in the source
    version of the module.
    These are moved into a separate folder called
    MODULE_CONFLICTS so
    that source and target module assets directly match.
    You can override this behavior to keep all target
    assets where they are. You'll likely want to do this
    when the source modules are not uniquely named.
  `)
  .option("--on-clobber <error|skip|overwrite>", oneline`
    If source module assets match target assets by name,
    but those matching assets are not in the same module
    in the target, an error is raised. This is to prevent
    accidental overwrite of assets that happen to have the
    same name but aren't actually the same thing.
    You can change the behavior to instead skip importing
    those assets (keeping the target version) or overwrite
    (deleting the target version and keeping the source
    version)
  `, 'error')
  .option(...options.targetProjectPath)
  .option(...options.force)
  .parse(process.argv);


importModules(cli);
