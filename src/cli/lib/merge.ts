import { Gms2MergerOptions } from '../../lib/Gms2ProjectMerger';
import { Gms2Project } from '../../lib/Gms2Project';
import assertions from './cli-assert';
import { assert, StitchError } from '../../lib/errors';

export interface Gms2MergeCliOptions extends Gms2MergerOptions {
  source?: string;
  sourceUrl?: string;
  sourceGithub?: string;
  targetProject?: string;
  force?: boolean;
}

export function parseGithubSourceString(source: string) {
  const match = source.match(
    /^(?<owner>[a-z0-9_.-]+)\/(?<name>[a-z0-9_.-]+)(?<revisionType>(@(?<revision>[a-z0-9_.-]+))|(\?(?<tagPattern>.+)?))?$/i,
  )?.groups as unknown as {
    owner: string;
    name: string;
    revision?: string;
    tagPattern?: string;
    revisionType?: '@' | '?';
  };
  if (match?.revisionType) {
    match.revisionType = match.revisionType?.[0] as '@' | '?';
  }
  return match;
}

export default async function (options: Gms2MergeCliOptions) {
  options.targetProject ||= process.cwd();
  assertions.assertPathExists(options.targetProject);
  const targetProject = new Gms2Project({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  // GitHub source?
  if (options.sourceGithub) {
    const repo = parseGithubSourceString(options.sourceGithub);
    assert(repo, 'Could not parse repo source string.');
    await targetProject.mergeFromGithub(repo.owner, repo.name, {
      ...options,
      revision: repo.revision,
      tagPattern: repo.tagPattern,
      revisionType: repo.revisionType,
    });
  }
  // URL source?
  else if (options.sourceUrl) {
    await targetProject.mergeFromUrl(options.sourceUrl, options);
  }
  // Local source
  else if (options.source) {
    targetProject.merge(options.source, options);
  } else {
    throw new StitchError('No source project provided.');
  }
}
