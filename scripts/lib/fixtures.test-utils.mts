import type { GitCommit } from './git.mts';
import type { PackageManifest, Project } from './workspace.mts';

let counter = 0;

/** Create a fake commit (newest-first arrays are built by the caller). */
export function commit(
  body: string,
  files: string[],
  options?: { tags?: string[]; date?: string },
): GitCommit {
  counter++;
  return {
    hash: counter.toString(16).padStart(40, '0'),
    date: new Date(options?.date || '2026-01-01T00:00:00Z'),
    tags: options?.tags || [],
    body,
    files,
  };
}

export function project(
  name: string,
  version: string,
  options?: {
    dir?: string;
    private?: boolean;
    deps?: string[];
    devDeps?: string[];
    displayName?: string;
  },
): Project {
  const dir = options?.dir || `packages/${name.replace(/^@[^/]+\//, '')}`;
  const manifest: PackageManifest = {
    name,
    version,
    displayName: options?.displayName,
    private: options?.private,
    dependencies: Object.fromEntries(
      (options?.deps || []).map((d) => [d, 'workspace:*']),
    ),
    devDependencies: Object.fromEntries(
      (options?.devDeps || []).map((d) => [d, 'workspace:*']),
    ),
  };
  return {
    name,
    version,
    dir,
    private: !!options?.private,
    manifestPath: `/repo/${dir}/package.json`,
    manifest,
  };
}
