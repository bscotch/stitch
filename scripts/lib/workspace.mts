import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PackageManifest {
  name: string;
  version: string;
  displayName?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface Project {
  name: string;
  version: string;
  /** Repo-relative, `/`-separated directory, e.g. `packages/yy` */
  dir: string;
  private: boolean;
  /** Absolute path to the `package.json` file */
  manifestPath: string;
  manifest: PackageManifest;
}

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/**
 * Load every `packages/*\/package.json` project, sorted so that
 * each project comes after all of its workspace dependencies.
 */
export function loadProjects(root: string): Project[] {
  const packagesDir = join(root, 'packages');
  const projects: Project[] = [];
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(packagesDir, entry.name, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf8'),
    ) as PackageManifest;
    projects.push({
      name: manifest.name,
      version: manifest.version,
      dir: `packages/${entry.name}`,
      private: !!manifest.private,
      manifestPath,
      manifest,
    });
  }
  return sortTopologically(projects);
}

/** Names of the workspace projects that `project` depends on (any dep type). */
export function internalDependencies(
  project: Pick<Project, 'manifest'>,
  projectNames: ReadonlySet<string>,
): string[] {
  const deps = new Set<string>();
  for (const field of DEP_FIELDS) {
    for (const name of Object.keys(project.manifest[field] || {})) {
      if (projectNames.has(name)) deps.add(name);
    }
  }
  return [...deps].sort();
}

/**
 * Sort projects so dependencies come before dependents. Ties are broken
 * alphabetically by name for stable output. Throws on cycles.
 */
export function sortTopologically<T extends Pick<Project, 'name' | 'manifest'>>(
  projects: T[],
): T[] {
  const names = new Set(projects.map((p) => p.name));
  const byName = new Map(projects.map((p) => [p.name, p]));
  const remainingDeps = new Map(
    projects.map((p) => [p.name, new Set(internalDependencies(p, names))]),
  );
  const sorted: T[] = [];
  while (remainingDeps.size) {
    const ready = [...remainingDeps]
      .filter(([, deps]) => deps.size === 0)
      .map(([name]) => name)
      .sort();
    if (!ready.length) {
      throw new Error(
        `Dependency cycle among: ${[...remainingDeps.keys()].join(', ')}`,
      );
    }
    for (const name of ready) {
      sorted.push(byName.get(name)!);
      remainingDeps.delete(name);
      for (const deps of remainingDeps.values()) deps.delete(name);
    }
  }
  return sorted;
}

/** Update a project's `package.json` version on disk (and in memory). */
export function writeProjectVersion(project: Project, version: string): void {
  const raw = readFileSync(project.manifestPath, 'utf8');
  const manifest = JSON.parse(raw) as PackageManifest;
  manifest.version = version;
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const json = JSON.stringify(manifest, null, 2).replace(/\n/g, eol);
  writeFileSync(project.manifestPath, `${json}${eol}`);
  project.version = version;
  project.manifest.version = version;
}
