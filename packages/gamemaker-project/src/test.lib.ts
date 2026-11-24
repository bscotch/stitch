import { Yy } from '@bscotch/yy';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after } from 'node:test';
import type { ProjectEventMap, ProjectEventName } from './project.state.ts';
import { GameMakerProject } from './project.ts';

export const samplesDir = path.resolve('../parser/samples');
const sandboxes: string[] = [];

after(async () => {
  for (const dir of sandboxes) {
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

/** Copy a sample project into a fresh temporary folder */
export async function sandbox(sample = 'project'): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gm-project-test-'));
  sandboxes.push(dir);
  const projectDir = path.join(dir, sample);
  await fs.cp(path.join(samplesDir, sample), projectDir, { recursive: true });
  return projectDir;
}

export async function openSandbox(
  sample = 'project',
): Promise<GameMakerProject> {
  return await GameMakerProject.open(await sandbox(sample), {
    changeDebounceMs: 20,
  });
}

/** Record the events a project emits */
export function recordEvents(project: GameMakerProject) {
  const events: { name: ProjectEventName; args: unknown[] }[] = [];
  const names: ProjectEventName[] = [
    'assetAdded',
    'assetRemoved',
    'assetChanged',
    'gmlChanged',
    'yypChanged',
    'configChanged',
    'includedFilesChanged',
    'error',
  ];
  for (const name of names) {
    project.on(name, ((...args: ProjectEventMap[typeof name]) =>
      events.push({ name, args })) as any);
  }
  return {
    events,
    names: () => events.map((e) => e.name),
    of: <E extends ProjectEventName>(name: E) =>
      events
        .filter((e) => e.name === name)
        .map((e) => e.args as ProjectEventMap[E]),
    clear: () => (events.length = 0),
  };
}

/** Read a yy file straight from disk */
export async function readYy(file: string): Promise<any> {
  return Yy.parse(await fs.readFile(file, 'utf8'));
}

/** Edit a yy/yyp file directly on disk, as an external program would */
export async function editYyOnDisk(
  file: string,
  edit: (data: any) => void,
): Promise<void> {
  const data = await readYy(file);
  edit(data);
  await fs.writeFile(file, Yy.stringify(data));
}

/**
 * Check that a project's in-memory state matches a fresh load from disk.
 */
export async function assertMatchesDisk(
  project: GameMakerProject,
  assert: typeof import('node:assert/strict'),
) {
  const fresh = await GameMakerProject.open(project.yypPath);
  const summarize = (p: GameMakerProject) =>
    p
      .listAssets()
      .map((a) => ({
        name: a.name,
        kind: a.kind,
        yyHash: a.yyHash,
        gml: [...a.gmlFiles].sort(),
        folder: a.folder,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(summarize(project), summarize(fresh));
  assert.deepEqual(project.folders.sort(), fresh.folders.sort());
}
