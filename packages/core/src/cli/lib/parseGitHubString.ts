import { Gms2GitHubRepoInfo } from '../../lib/StitchProjectMerger.js';
import { assert } from '../../utility/errors.js';

export function parseGitHubString(source: string): Gms2GitHubRepoInfo {
  const match = source.match(
    /^(?<repoOwner>[a-z0-9_.-]+)\/(?<repoName>[a-z0-9_.-]+)(?<revisionType>(@(?<revision>[a-z0-9_.-]+))|(\?(?<tagPattern>.+)?))?$/i,
  )?.groups as unknown as Gms2GitHubRepoInfo;
  assert(match, `Invalid GitHub repo string: ${source}`);
  if (match?.revisionType) {
    match.revisionType = match.revisionType?.[0] as '@' | '?';
  }
  return match;
}
