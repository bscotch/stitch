import { keysOf } from '@bscotch/utility';
import { ArgumentConfig, parse as parseArgs } from 'ts-command-line-args';
import { StitchProject } from '../../index.js';
import { assert } from '../../utility/errors.js';
import { globalParams } from './params.global.js';
import { StitchCliParams, StitchCliTargetParams } from './params.types.js';

export * from './params.global.js';
export * from './params.merge.js';
export * from './params.types.js';

export async function loadProjectFromArgs<T extends StitchCliTargetParams>(
  options: T,
) {
  return await StitchProject.load({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
    readOnly: options.readOnly,
  });
}

export function parseStitchArgs<T extends Record<string, any>>(
  args: ArgumentConfig<T>,
  info: {
    title: string;
    description: string;
  },
): StitchCliParams<T> {
  const argsConfig: ArgumentConfig<StitchCliParams<T>> = {
    ...args,
    ...globalParams,
  };
  const argNames = keysOf(argsConfig);
  const groups: string[] = argNames.map((name) => {
    // @ts-expect-error
    const { group } = argsConfig[name];
    assert(
      group,
      `Argument definition for ${name as any} does not have a group.`,
    );
    return group;
  });
  return parseArgs<StitchCliParams<T>>(argsConfig, {
    // @ts-expect-error
    helpArg: 'help',
    headerContentSections: [
      {
        header: info.title,
        content: info.description,
      },
    ],
    optionSections: [...new Set(groups)].map((groupName) => ({
      group: groupName,
      header: groupName,
    })),
  });
}
