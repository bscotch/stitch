import { md5 } from '@bscotch/utility';
import fs from 'fs-extra';
import { getGithubAccessToken } from '../utility/env.js';
import { assert } from '../utility/errors.js';
import { get, unzipRemote } from '../utility/http.js';
import paths from '../utility/paths.js';
import type { StitchProject } from './StitchProject.js';
import type {
  Gms2MergerGitHubOptions,
  StitchMergerOptions,
} from './StitchProjectMerger.js';

export async function mergeFromGithub(
  this: StitchProject,
  options: Gms2MergerGitHubOptions,
) {
  // Figure out the revision based on options.
  let revision = options?.revision || 'HEAD';
  const token = getGithubAccessToken();
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const apiBase = `https://api.github.com/repos/${options.repoOwner}/${options.repoName}`;
  if (options.revisionType == '?') {
    // Then need to query the GitHub API.
    const { tagPattern } = options;
    const tags = (await get(`${apiBase}/tags`, headers)).data as {
      name: string;
    }[];
    const latestMatchingTag = tagPattern
      ? tags.find((tag) => tag.name.match(new RegExp(tagPattern, 'i')))
      : tags[0];
    assert(latestMatchingTag, `No GitHub tag matches pattern ${tagPattern}`);
    revision = latestMatchingTag.name;
  }
  const url = `https://github.com/${options.repoOwner}/${options.repoName}/archive/${revision}.zip`;
  await this.mergeFromUrl(url, options, headers);
  return this;
}

export async function mergeFromUrl(
  this: StitchProject,
  url: string,
  options?: StitchMergerOptions,
  headers?: { [header: string]: any },
) {
  const unzipPath = paths.join(
    paths.dirname(this.yypPathAbsolute),
    `tmp-${md5(url)}`,
  );
  const sourcePath = await unzipRemote(url, unzipPath, headers);
  await this.merge(sourcePath, options);
  await fs.emptyDir(unzipPath);
  await fs.remove(unzipPath);
  return this;
}
