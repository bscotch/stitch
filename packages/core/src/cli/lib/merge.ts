import {
  Gms2GitHubRepoInfo,
  StitchMergerOptions,
} from '../../lib/StitchProjectMerger.js';
import { StitchError } from '../../utility/errors.js';
import { loadProjectFromArgs } from './params.js';
import {
  StitchCliGlobalParams,
  StitchCliTargetParams,
} from './params.types.js';

export interface Gms2MergeCliSourceOptions {
  source?: string;
  sourceUrl?: string;
  sourceGithub?: Gms2GitHubRepoInfo;
}

export interface Gms2MergeCliOptions
  extends Gms2MergeCliSourceOptions,
    StitchMergerOptions,
    StitchCliTargetParams,
    StitchCliGlobalParams {}

export async function stitchCliMerge(options: Gms2MergeCliOptions) {
  const targetProject = await loadProjectFromArgs(options);
  // GitHub source?
  if (options.sourceGithub) {
    await targetProject.mergeFromGithub({
      ...options,
      ...options.sourceGithub,
    });
  }
  // URL source?
  else if (options.sourceUrl) {
    await targetProject.mergeFromUrl(options.sourceUrl, options);
  }
  // Local source
  else if (options.source) {
    await targetProject.merge(options.source, options);
  } else {
    throw new StitchError('No source project provided.');
  }
}
