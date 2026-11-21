/**
 * @file Suppressing the IDE's "IDE Update Available" prompt for IDEs that
 * Stitch launches.
 *
 * Cached IDEs are usually older than their channel's latest release, so
 * they'd show that prompt on every boot. The IDE checks for updates once,
 * at boot (within ~5s), using the `updateURI` macro, which can be
 * overridden in `<system dir>/default_macros.json`. So for each launch:
 *
 * 1. Back up that file's original state in Stitch's state dir.
 * 2. Point `updateURI` at a feed that doesn't exist (the check fails with
 *    a 403, so no prompt), keeping any other overrides.
 * 3. Restore the original as soon as `ui.log` shows the boot check, after
 *    a timeout, or when the IDE exits, whichever is first. With several
 *    launches of one channel in flight, restore after the last.
 *
 * If Stitch dies before restoring, the next `restoreUpdatePrompts` call
 * restores it: launches older than {@link staleLaunchMs} are long past their
 * boot check. That also cleans up after the old (pre-v2) launcher, which
 * wrote a fake URI to every channel and never restored it.
 */
import { mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exists, stripBom, writeJsonAtomic } from './fsUtil.ts';
import {
  resolveOptions,
  type AnyLauncherOptions,
  type ResolvedOptions,
} from './options.ts';
import { computeGameMakerDirs, knownProgramDirNames } from './paths.ts';

/** The fake update feed. On GameMaker's host, so the check fails with a 403. */
export const fakeUpdateUri =
  'https://gms.yoyogames.com/update-stitch-disabled.rss';

/** Whether a URI is one Stitch wrote (including the old launcher's) */
export function isStitchFakeUpdateUri(uri: unknown): boolean {
  return (
    typeof uri === 'string' &&
    (uri === fakeUpdateUri || /TOTALLY-FAKE/i.test(uri))
  );
}

/** How long to wait for the boot-time update check before restoring anyway */
export const updateCheckTimeoutMs = 60_000;
/** Launches older than this have certainly finished their boot check */
export const staleLaunchMs = 90_000;

/**
 * Lines in `ui.log` that show the IDE's boot-time update check. Observed:
 * `Download op:1 file url: <updateURI>` and then (about a second later)
 * `CheckForIDEUpdates Failed: … (403) Forbidden.` Either means the IDE has
 * already read `updateURI`.
 */
export const updateCheckLogPattern =
  /CheckForIDEUpdates|update-stitch-disabled|TOTALLY-FAKE|update-(?:win|mac|linux)/i;

export interface UpdatePromptLaunch {
  id: string;
  launchedAt: number;
  /** Set once the launch's update check is over */
  done?: boolean;
}

export interface UpdatePromptRecord {
  defaultMacrosFile: string;
  /** The file's state before Stitch changed it */
  original: { absent: true } | { contents: string };
  /** What Stitch wrote, to tell whether anyone changed it since */
  written: string;
  appliedAt: number;
  launches: UpdatePromptLaunch[];
}

export interface UpdatePromptState {
  /** Keyed by the `default_macros.json` path */
  records: Record<string, UpdatePromptRecord>;
}

export interface UpdatePromptContext {
  stateFile: string;
  now?: () => number;
}

function stateFileFor(opts: ResolvedOptions) {
  return opts.platform.path.join(opts.stateDir, 'update-prompt.json');
}

// Serialize state changes within this process
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

async function readState(stateFile: string): Promise<UpdatePromptState> {
  try {
    const parsed = JSON.parse(stripBom(await readFile(stateFile, 'utf8')));
    if (parsed && typeof parsed === 'object' && parsed.records) return parsed;
  } catch {
    // Missing or corrupt: start fresh
  }
  return { records: {} };
}

async function readRaw(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return;
  }
}

function parseMacros(
  raw: string | undefined,
): Record<string, unknown> | undefined {
  if (raw === undefined) return {};
  try {
    const parsed = JSON.parse(stripBom(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return;
  }
}

function stringifyMacros(macros: Record<string, unknown>) {
  return JSON.stringify(macros, null, 2);
}

/** Remove a leftover fake URI (and old `.bk.json` backup) that has no record */
async function migrateLeftover(defaultMacrosFile: string): Promise<boolean> {
  const raw = await readRaw(defaultMacrosFile);
  const macros = parseMacros(raw);
  if (!macros || !isStitchFakeUpdateUri(macros.updateURI)) return false;
  delete macros.updateURI;
  if (Object.keys(macros).length) {
    await writeFile(defaultMacrosFile, stringifyMacros(macros));
  } else {
    await rm(defaultMacrosFile, { force: true });
  }
  // The old launcher's backups were made after the fake URI was written,
  // so they can't restore anything.
  await rm(defaultMacrosFile.replace(/\.json$/i, '.bk.json'), { force: true });
  return true;
}

async function restoreRecord(record: UpdatePromptRecord) {
  const file = record.defaultMacrosFile;
  const raw = await readRaw(file);
  if (raw === record.written) {
    // Unchanged since Stitch wrote it: put back exactly what was there.
    if ('absent' in record.original) await rm(file, { force: true });
    else await writeFile(file, record.original.contents);
    return;
  }
  // Someone else changed the file since. Only undo Stitch's own change.
  const macros = parseMacros(raw);
  if (!macros || !isStitchFakeUpdateUri(macros.updateURI)) return;
  const original =
    'absent' in record.original
      ? {}
      : (parseMacros(record.original.contents) ?? {});
  if (original.updateURI !== undefined) macros.updateURI = original.updateURI;
  else delete macros.updateURI;
  if (Object.keys(macros).length || !('absent' in record.original)) {
    await writeFile(file, stringifyMacros(macros));
  } else {
    await rm(file, { force: true });
  }
}

/** Restore records with no launches still awaiting their update check */
async function restoreIdle(state: UpdatePromptState, now: number) {
  for (const [key, record] of Object.entries(state.records)) {
    const pending = record.launches.filter(
      (l) => !l.done && now - l.launchedAt < staleLaunchMs,
    );
    if (pending.length) {
      record.launches = pending;
      continue;
    }
    await restoreRecord(record);
    delete state.records[key];
  }
}

/**
 * Point a system dir's `updateURI` at the fake feed for one launch.
 * Returns the launch id to pass to {@link finishUpdatePromptLaunch}, or
 * `undefined` if the file couldn't be parsed (it's left alone).
 */
export function beginUpdatePromptLaunch(
  defaultMacrosFile: string,
  ctx: UpdatePromptContext,
): Promise<string | undefined> {
  return serialized(async () => {
    const now = (ctx.now ?? Date.now)();
    const state = await readState(ctx.stateFile);
    const raw = await readRaw(defaultMacrosFile);
    const macros = parseMacros(raw);
    if (!macros) return;
    let record = state.records[defaultMacrosFile];
    if (!record || !isStitchFakeUpdateUri(macros.updateURI)) {
      // No (valid) record. If the fake URI is there anyway, it's a leftover
      // from the old launcher: the real original is the file without it.
      let original: UpdatePromptRecord['original'] =
        raw === undefined ? { absent: true } : { contents: raw };
      if (isStitchFakeUpdateUri(macros.updateURI)) {
        await migrateLeftover(defaultMacrosFile);
        const migrated = await readRaw(defaultMacrosFile);
        original =
          migrated === undefined ? { absent: true } : { contents: migrated };
        delete macros.updateURI;
      }
      const written = stringifyMacros({ ...macros, updateURI: fakeUpdateUri });
      await mkdir(path.dirname(defaultMacrosFile), { recursive: true });
      await writeFile(defaultMacrosFile, written);
      record = {
        defaultMacrosFile,
        original,
        written,
        appliedAt: now,
        launches: [],
      };
      state.records[defaultMacrosFile] = record;
    }
    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    record.launches.push({ id, launchedAt: now });
    await writeJsonAtomic(ctx.stateFile, state);
    return id;
  });
}

/**
 * Mark a launch's update check as over, and restore the original
 * `default_macros.json` if no other launch still needs the override.
 */
export function finishUpdatePromptLaunch(
  defaultMacrosFile: string,
  launchId: string,
  ctx: UpdatePromptContext,
): Promise<void> {
  return serialized(async () => {
    const state = await readState(ctx.stateFile);
    const record = state.records[defaultMacrosFile];
    const launch = record?.launches.find((l) => l.id === launchId);
    if (launch) launch.done = true;
    await restoreIdle(state, (ctx.now ?? Date.now)());
    await writeJsonAtomic(ctx.stateFile, state);
  });
}

/**
 * Restore every update-prompt override that's no longer needed (e.g.
 * because Stitch exited or crashed before restoring), and clean up the old
 * launcher's leftovers. Cheap: it only reads small files. Called by the
 * other launcher functions; callers can also run it at startup.
 */
export async function restoreUpdatePrompts(
  options?: AnyLauncherOptions,
  ctx?: Partial<UpdatePromptContext> & { defaultMacrosFiles?: string[] },
): Promise<void> {
  const opts = resolveOptions(options);
  const stateFile = ctx?.stateFile ?? stateFileFor(opts);
  const files =
    ctx?.defaultMacrosFiles ??
    [
      ...new Set([
        ...knownProgramDirNames(),
        ...Object.keys(opts.gameMakerDirs),
      ]),
    ].map((pdn) => computeGameMakerDirs(pdn, opts).defaultMacros);
  await serialized(async () => {
    const state = await readState(stateFile);
    await restoreIdle(state, (ctx?.now ?? Date.now)());
    for (const file of files) {
      if (!state.records[file]) await migrateLeftover(file);
    }
    if (Object.keys(state.records).length || (await exists(stateFile))) {
      await writeJsonAtomic(stateFile, state);
    }
  });
}

/**
 * Resolve once `ui.log` shows the boot-time update check (`"checked"`),
 * after `timeoutMs` (`"timeout"`), or when aborted (`"aborted"`). Only
 * lines written after `fromOffset` count. A shrinking file means the log
 * was rotated, so reading starts over.
 */
export async function waitForUpdateCheck(
  logFile: string,
  fromOffset: number,
  options?: { timeoutMs?: number; pollMs?: number; signal?: AbortSignal },
): Promise<'checked' | 'timeout' | 'aborted'> {
  const deadline = Date.now() + (options?.timeoutMs ?? updateCheckTimeoutMs);
  const pollMs = options?.pollMs ?? 1000;
  let offset = fromOffset;
  let carry = '';
  while (Date.now() < deadline) {
    if (options?.signal?.aborted) return 'aborted';
    try {
      const size = (await stat(logFile)).size;
      if (size < offset) {
        offset = 0;
        carry = '';
      }
      if (size > offset) {
        const handle = await open(logFile, 'r');
        try {
          const buffer = Buffer.alloc(size - offset);
          await handle.read(buffer, 0, buffer.length, offset);
          offset = size;
          const text = carry + buffer.toString('utf8');
          if (updateCheckLogPattern.test(text)) return 'checked';
          carry = text.slice(-200);
        } finally {
          await handle.close();
        }
      }
    } catch {
      // Not created yet
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return 'timeout';
}

/** The size of a file, or 0 if it doesn't exist */
export async function fileSize(file: string) {
  return (await stat(file).catch(() => ({ size: 0 }))).size;
}

export { stateFileFor as updatePromptStateFile };
