import { oneline } from '@bscotch/utility';
import {
  Gms2ResourceArray,
  Gms2ResourceType,
} from '../../lib/components/Gms2ResourceArray.js';
import { assert } from '../../utility/errors.js';
import { parseGitHubString } from './parseGitHubString.js';
import { makeComposableBuilder } from 'cli-forge';

const mergeSourceGroup = 'Merge Source';

export const withMergeSourceParams = makeComposableBuilder((argv) =>
  argv
    .option('source', {
      alias: ['s'],
      type: 'string',
      group: mergeSourceGroup,
      description: 'Local path to the source GameMaker Studio 2 project.',
    })
    .option('sourceGithub', {
      alias: ['g'],
      type: 'string',
      coerce: parseGitHubString,
      group: mergeSourceGroup,
      description: oneline`
      Repo owner and name for a Gamemaker Studio 2 project
      on GitHub in format \`owner/repo@revision\`.
      The revision suffix is optional, and
      can be a branch name, a tag, or a commit hash.
      Alternatively, the format \`owner/repo?\` will
      use the most recent tagged commit.
      Finally, the format \`owner/repo?tagPattern\`
      will use the most recent tagged commit where the tag matches
      the pattern. For example, pattern \`^v(\\d+\\.)\\{2\\}\\\\d+$\` would
      match standard semver tags, like "v1.0.0". If no revision or
      tagPattern is provided, Stitch uses HEAD. To provide
      credentials for private GitHub repos, see the README.
    `,
    })
    .option('sourceUrl', {
      alias: ['u'],
      type: 'string',
      group: mergeSourceGroup,
      description: 'URL to a zipped GameMaker Studio 2 project.',
    }),
);

const mergeOptionsGroup = 'Merge Options';

export const withMergeOptionsParams = makeComposableBuilder((argv) =>
  argv
    .option('ifFolderMatches', {
      type: 'array',
      items: 'string',
      group: mergeOptionsGroup,
      description: oneline`
      List of source folder patterns that, if matched,
      should have all child assets imported (recursive).
      Will be passed to \`new RegExp()\` and tested against
      the parent folder of every source resource.
      Independent from ifNameMatches. Case is ignored.
    `,
    })
    .option('ifNameMatches', {
      type: 'array',
      items: 'string',
      group: mergeOptionsGroup,
      description: oneline`
      List of source resource name patterns that, if matched,
      should have all child assets imported (recursive).
      Will be passed to \`new RegExp()\` and tested against
      the name of every source resource.
      Independent from ifFolderMatches. Case is ignored.
    `,
    })
    .option('moveConflicting', {
      type: 'boolean',
      group: mergeOptionsGroup,
      description: oneline`
      The target project may have assets matching your
      merge pattern, but that aren't in the source.
      By default these are left alone, which can create some
      confusion about which assets came from which projects.
      Using this flag will cause conflicting target assets
      to be moved into a folder called
      MERGE_CONFLICTS for future reorganization. Only use
      this flag if your source and target projects are using
      unique folder names for their assets.
    `,
    })
    .option('onClobber', {
      type: 'string',
      defaultValue: 'overwrite',
      group: mergeOptionsGroup,
      choices: ['overwrite', 'skip', 'error'],
      description: oneline`
      If source assets match target assets by name,
      but those matching assets are not matched by the merge
      options, it's possible that the two assets are not
      the same thing. By default Stitch overwrites anyway.
      You can change the behavior to instead skip importing
      those assets (keeping the target version) or throw an error.
    `,
    })
    .option('skipDependencyCheck', {
      type: 'boolean',
      group: mergeOptionsGroup,
      description: oneline`
      If an object in your source has dependencies
      (parent objects or sprites) that are *not* being merged,
      import will be blocked. This prevents accidentally importing
      broken assets. If you know that those missing dependencies
      will be found in the target project, you can skip this check.
    `,
    })
    .option('skipIncludedFiles', {
      type: 'boolean',
      group: mergeOptionsGroup,
      description: oneline`
      By default, "Included Files" are also merged if
      they match filters. These can be skipped.
    `,
    })
    .option('types', {
      type: 'array',
      items: 'string',
      group: mergeOptionsGroup,
      description: oneline`
      All resource types are included by default. You can
      optionally change to a whitelist pattern and only
      include specific types. Types are:
      ${Object.keys(Gms2ResourceArray.resourceClassMap).join(', ')}
    `,
      coerce: (inputs: string[]) => {
        return inputs.map((input) => {
          assert(
            Gms2ResourceArray.resourceTypeNames.includes(input as any),
            `Invalid resource type: ${input}`,
          );
          return input as Gms2ResourceType;
        });
      },
    }),
);
