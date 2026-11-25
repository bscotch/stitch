import assert from 'node:assert/strict';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { exists } from './fsUtil.ts';
import { put, testOptions, tmpDir } from '../test/helpers.ts';
import {
  beginUpdatePromptLaunch,
  fakeUpdateUri,
  finishUpdatePromptLaunch,
  isStitchFakeUpdateUri,
  restoreUpdatePrompts,
  staleLaunchMs,
  updateCheckLogPattern,
  waitForUpdateCheck,
} from './updatePrompt.ts';

const oldFakeUri =
  'http://gms.yoyogames.com/update-win-NuBeta-TOTALLY-FAKE.rss';

async function setup() {
  const root = await tmpDir();
  const file = path.join(root, 'system', 'default_macros.json');
  const stateFile = path.join(root, 'state', 'update-prompt.json');
  let now = 1_000_000;
  const ctx = { stateFile, now: () => now };
  const advance = (ms: number) => (now += ms);
  const read = async () => JSON.parse(await readFile(file, 'utf8'));
  const restore = () =>
    restoreUpdatePrompts(testOptions(root, undefined), {
      ...ctx,
      defaultMacrosFiles: [file],
    });
  return { root, file, stateFile, ctx, advance, read, restore };
}

describe('Update prompt suppression', function () {
  it("recognizes the boot-time update check in each OS's ui.log", function () {
    for (const line of [
      // Windows
      '[10:01:02:003(1a2b)] Download op:1 file url: https://gms.yoyogames.com/update-stitch-disabled.rss',
      '[10:01:03:003(1a2b)] CheckForIDEUpdates Failed: The remote server returned an error: (403) Forbidden.',
      // Linux, with the fake feed and with a real one
      '[09:27:40:062(742b)] DoUpdateDownload exception System.Net.WebException: The remote server returned an error: (403) Forbidden.',
      '[09:20:06:718(c13f)] Update found - got 55 items',
    ]) {
      assert.match(line, updateCheckLogPattern);
    }
    for (const line of [
      '[09:20:06:713(c13f)] Current assembly revision is 2026.100.0.1199',
      '[09:27:40:134(742b)] LoadingState: CheckingRSS',
    ]) {
      assert.doesNotMatch(line, updateCheckLogPattern);
    }
  });

  it('recognizes its own fake URIs', function () {
    assert.ok(isStitchFakeUpdateUri(fakeUpdateUri));
    assert.ok(isStitchFakeUpdateUri(oldFakeUri));
    assert.ok(
      !isStitchFakeUpdateUri('https://gms.yoyogames.com/update-win-NuBeta.rss'),
    );
    assert.ok(!isStitchFakeUpdateUri(undefined));
  });

  it('creates the file when absent, and deletes it on restore', async function () {
    const { file, ctx, read } = await setup();
    const id = await beginUpdatePromptLaunch(file, ctx);
    assert.ok(id);
    assert.deepEqual(await read(), { updateURI: fakeUpdateUri });
    await finishUpdatePromptLaunch(file, id, ctx);
    assert.equal(await exists(file), false);
  });

  it("keeps the user's other overrides, and restores the exact original", async function () {
    const { file, ctx, read } = await setup();
    const original =
      '{\n\t"runtimeURI": "https://example.com/runtimes.rss",\n\t"updateURI": "https://example.com/ide.rss"\n}';
    await put(file, original);
    const id = await beginUpdatePromptLaunch(file, ctx);
    assert.deepEqual(await read(), {
      runtimeURI: 'https://example.com/runtimes.rss',
      updateURI: fakeUpdateUri,
    });
    await finishUpdatePromptLaunch(file, id!, ctx);
    assert.equal(await readFile(file, 'utf8'), original);
  });

  it('only undoes its own change if someone edited the file meanwhile', async function () {
    const { file, ctx, read } = await setup();
    await put(file, { runtimeURI: 'https://example.com/a.rss' });
    const id = await beginUpdatePromptLaunch(file, ctx);
    const edited = { ...(await read()), extra: 'added by the IDE' };
    await writeFile(file, JSON.stringify(edited));
    await finishUpdatePromptLaunch(file, id!, ctx);
    assert.deepEqual(await read(), {
      runtimeURI: 'https://example.com/a.rss',
      extra: 'added by the IDE',
    });
  });

  it('waits for every concurrent launch of a channel before restoring', async function () {
    const { file, ctx, read } = await setup();
    const first = await beginUpdatePromptLaunch(file, ctx);
    const second = await beginUpdatePromptLaunch(file, ctx);
    await finishUpdatePromptLaunch(file, first!, ctx);
    assert.equal(
      (await read()).updateURI,
      fakeUpdateUri,
      'Still needed by the second launch',
    );
    await finishUpdatePromptLaunch(file, second!, ctx);
    assert.equal(await exists(file), false);
  });

  it("doesn't overwrite the backup when re-applied", async function () {
    const { file, ctx, stateFile } = await setup();
    await put(file, { runtimeURI: 'x' });
    await beginUpdatePromptLaunch(file, ctx);
    await beginUpdatePromptLaunch(file, ctx);
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    assert.deepEqual(JSON.parse(state.records[file].original.contents), {
      runtimeURI: 'x',
    });
  });

  it('restores leftovers after a crash, once launches are stale', async function () {
    const { file, ctx, advance, restore } = await setup();
    await put(file, { runtimeURI: 'x' });
    await beginUpdatePromptLaunch(file, ctx); // never finished
    await restore();
    assert.ok(
      isStitchFakeUpdateUri(JSON.parse(await readFile(file, 'utf8')).updateURI),
      'Launch may still be booting',
    );
    advance(staleLaunchMs + 1);
    await restore();
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
      runtimeURI: 'x',
    });
  });

  it("migrates the old launcher's leftovers", async function () {
    const { file, restore } = await setup();
    const backup = file.replace(/\.json$/, '.bk.json');
    await put(file, {
      updateURI: oldFakeUri,
      runtimeURI: 'https://example.com/r.rss',
    });
    await put(backup, { updateURI: oldFakeUri });
    await restore();
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
      runtimeURI: 'https://example.com/r.rss',
    });
    assert.equal(await exists(backup), false);

    await put(file, { updateURI: oldFakeUri });
    await restore();
    assert.equal(await exists(file), false, 'Nothing else was in it');
  });

  it('migrates old leftovers when applying, using the file without them as the original', async function () {
    const { file, ctx, read } = await setup();
    await put(file, { updateURI: oldFakeUri, runtimeURI: 'r' });
    const id = await beginUpdatePromptLaunch(file, ctx);
    assert.deepEqual(await read(), {
      runtimeURI: 'r',
      updateURI: fakeUpdateUri,
    });
    await finishUpdatePromptLaunch(file, id!, ctx);
    assert.deepEqual(await read(), { runtimeURI: 'r' });
  });

  it('leaves unparseable files alone', async function () {
    const { file, ctx } = await setup();
    await put(file, '{ not json');
    assert.equal(await beginUpdatePromptLaunch(file, ctx), undefined);
    assert.equal(await readFile(file, 'utf8'), '{ not json');
  });
});

describe('Waiting for the update check', function () {
  it('resolves when ui.log shows the check, ignoring earlier lines', async function () {
    const root = await tmpDir();
    const log = path.join(root, 'ui.log');
    await put(log, '[old] CheckForIDEUpdates Failed\n');
    const offset = (await readFile(log)).length;
    const waiting = waitForUpdateCheck(log, offset, {
      timeoutMs: 5000,
      pollMs: 20,
    });
    await new Promise((r) => setTimeout(r, 60));
    await appendFile(
      log,
      '[11:17:24:454(e295)] Download op:1 file url: https://gms.yoyogames.com/update-stitch-disabled.rss\n',
    );
    assert.equal(await waiting, 'checked');
  });

  it('times out, and restarts after log rotation', async function () {
    const root = await tmpDir();
    const log = path.join(root, 'ui.log');
    await put(log, 'x'.repeat(1000));
    assert.equal(
      await waitForUpdateCheck(log, 1000, { timeoutMs: 100, pollMs: 20 }),
      'timeout',
    );
    const waiting = waitForUpdateCheck(log, 1000, {
      timeoutMs: 5000,
      pollMs: 20,
    });
    await new Promise((r) => setTimeout(r, 60));
    await writeFile(log, 'CheckForIDEUpdates Failed: (403) Forbidden.\n'); // rotated: smaller
    assert.equal(await waiting, 'checked');
  });

  it('can be aborted', async function () {
    const root = await tmpDir();
    const controller = new AbortController();
    const waiting = waitForUpdateCheck(path.join(root, 'missing.log'), 0, {
      timeoutMs: 5000,
      pollMs: 20,
      signal: controller.signal,
    });
    controller.abort();
    assert.equal(await waiting, 'aborted');
  });
});
