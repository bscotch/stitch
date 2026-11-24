/**
 * Tests for keeping the project in sync with changes made outside of it
 * (GameMaker, git, other tools), and for not losing those changes.
 */
import { Yy } from '@bscotch/yy';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  assertMatchesDisk,
  editYyOnDisk,
  openSandbox,
  readYy,
  recordEvents,
} from './test.lib.ts';
import { GameMakerProject } from './project.ts';
import { sleep } from './util.ts';

async function waitFor(condition: () => boolean, timeoutMs = 5000) {
  const start = Date.now();
  while (!condition()) {
    assert.ok(Date.now() - start < timeoutMs, 'Timed out waiting');
    await sleep(20);
  }
}

/** Add a copy of an existing script directly on disk, as GameMaker would */
async function addScriptOnDisk(
  projectDir: string,
  yypPath: string,
  name: string,
) {
  const dir = path.join(projectDir, 'scripts', name);
  await fs.mkdir(dir, { recursive: true });
  const yy = await readYy(path.join(projectDir, 'scripts/Script1/Script1.yy'));
  yy.name = name;
  yy['%Name'] = name;
  await fs.writeFile(path.join(dir, `${name}.yy`), Yy.stringify(yy));
  await fs.writeFile(path.join(dir, `${name}.gml`), `// ${name}`);
  await editYyOnDisk(yypPath, (yyp) => {
    yyp.resources.push({ id: { name, path: `scripts/${name}/${name}.yy` } });
  });
}

describe('Syncing with disk', function () {
  describe('external changes', function () {
    it('picks up assets added and removed in the yyp', async function () {
      const project = await openSandbox();
      const events = recordEvents(project);
      await addScriptOnDisk(project.dir, project.yypPath, 'scr_external');
      project.notifyChanged(project.yypPath);
      await project.idle();
      assert.deepEqual(
        events.of('assetAdded').map(([a]) => a.name),
        ['scr_external'],
      );
      const added = project.requireAsset('scr_external');
      assert.equal(added.gmlFiles.length, 1);

      events.clear();
      await editYyOnDisk(project.yypPath, (yyp) => {
        yyp.resources = yyp.resources.filter(
          (r: any) => r.id.name !== 'scr_external',
        );
      });
      project.notifyChanged(project.yypPath);
      await project.idle();
      assert.deepEqual(
        events.of('assetRemoved').map(([a]) => a.name),
        ['scr_external'],
      );
      assert.equal(project.getAsset('scr_external'), undefined);
    });

    it('picks up yy and GML changes', async function () {
      const project = await openSandbox();
      const object = project.requireAsset('o_object', 'objects');
      const events = recordEvents(project);

      await editYyOnDisk(object.yyPath, (yy) => {
        yy.spriteId = { name: 'sp_new', path: 'sprites/sp_new/sp_new.yy' };
      });
      await fs.appendFile(object.gmlFiles[0], '\n// changed');
      project.notifyChanged([object.yyPath, object.gmlFiles[0]]);
      await project.idle();

      assert.equal(object.spriteName, 'sp_new');
      const [[changed, change]] = events.of('assetChanged');
      assert.equal(changed, object);
      assert.equal(change.yy, true);
      assert.deepEqual(events.of('gmlChanged'), [[object, object.gmlFiles[0]]]);
    });

    it('reports nothing when nothing actually changed', async function () {
      const project = await openSandbox();
      const events = recordEvents(project);
      const object = project.requireAsset('o_object');
      // Rewrite with identical content
      await fs.writeFile(object.yyPath, await fs.readFile(object.yyPath));
      await fs.writeFile(project.yypPath, await fs.readFile(project.yypPath));
      project.notifyChanged([object.yyPath, project.yypPath]);
      await project.idle();
      assert.deepEqual(events.names(), []);
    });

    it('coalesces bursts of changes', async function () {
      const project = await openSandbox();
      const object = project.requireAsset('o_object', 'objects');
      const events = recordEvents(project);
      for (let i = 0; i < 20; i++) {
        await editYyOnDisk(object.yyPath, (yy) => {
          yy.visible = i % 2 === 0;
        });
        project.notifyChanged(object.yyPath);
      }
      await project.idle();
      assert.equal(events.of('assetChanged').length, 1);
    });

    it('recovers from reading a half-written yyp', async function () {
      const project = await openSandbox();
      const events = recordEvents(project);
      const good = await fs.readFile(project.yypPath, 'utf8');
      await fs.writeFile(project.yypPath, good.slice(0, good.length / 2));
      project.notifyChanged(project.yypPath);
      await project.idle();
      assert.ok(events.of('error').length > 0);
      assert.ok(project.getAsset('Script1'), 'Lost state');

      // The writer finishes
      await fs.writeFile(project.yypPath, good);
      await addScriptOnDisk(project.dir, project.yypPath, 'scr_later');
      project.notifyChanged(project.yypPath);
      await project.idle();
      assert.ok(project.getAsset('scr_later'));
      assert.ok(project.getAsset('Script1'));
    });

    it('can check everything at once', async function () {
      const project = await openSandbox();
      const events = recordEvents(project);
      await addScriptOnDisk(project.dir, project.yypPath, 'scr_untracked');
      await editYyOnDisk(project.requireAsset('o_object').yyPath, (yy) => {
        yy.visible = !yy.visible;
      });
      await project.reconcile();
      assert.ok(project.getAsset('scr_untracked'));
      assert.ok(events.of('assetChanged').some(([a]) => a.name === 'o_object'));
      await assertMatchesDisk(project, assert);
    });
  });

  describe('not losing external changes', function () {
    it('keeps yyp changes made after the project last read it', async function () {
      const project = await openSandbox();
      // Something else changes the yyp, and the project hasn't been told
      await editYyOnDisk(project.yypPath, (yyp) => {
        yyp.Folders.push({
          $GMFolder: '',
          '%Name': 'External',
          folderPath: 'folders/External.yy',
          name: 'External',
          resourceType: 'GMFolder',
          resourceVersion: '2.0',
        });
      });
      await addScriptOnDisk(project.dir, project.yypPath, 'scr_external');
      await project.createScript('Scripts/scr_mine');

      const yyp = await readYy(project.yypPath);
      const names = yyp.resources.map((r: any) => r.id.name);
      assert.ok(names.includes('scr_external'), 'Lost an external asset');
      assert.ok(names.includes('scr_mine'));
      assert.ok(
        yyp.Folders.some((f: any) => f.name === 'External'),
        'Lost an external folder',
      );
      // And the project noticed the external changes, too
      assert.ok(project.getAsset('scr_external'));
      assert.ok(project.folders.includes('External'));
    });

    it('keeps yy changes made after the project last read it', async function () {
      const project = await openSandbox();
      const object = project.requireAsset('o_object', 'objects');
      await editYyOnDisk(object.yyPath, (yy) => {
        yy.persistent = true;
      });
      await project.setObjectSprite(object, 'sp_new');
      const yy = await readYy(object.yyPath);
      assert.equal(yy.persistent, true, 'Lost an external change');
      assert.equal(yy.spriteId.name, 'sp_new');
      assert.equal((object.yy as any).persistent, true);
    });

    it('includes pending external changes when updating references', async function () {
      const project = await openSandbox();
      // GameMaker adds an object using a sprite; the project has been told,
      // but hasn't processed it yet when a rename starts.
      await addScriptOnDisk(project.dir, project.yypPath, 'scr_unused');
      const objectYy = await readYy(project.requireAsset('o_object').yyPath);
      const dir = path.join(project.dir, 'objects/o_external');
      await fs.mkdir(dir, { recursive: true });
      objectYy.name = 'o_external';
      objectYy['%Name'] = 'o_external';
      objectYy.spriteId = { name: 'sp_new', path: 'sprites/sp_new/sp_new.yy' };
      objectYy.eventList = [];
      await fs.writeFile(
        path.join(dir, 'o_external.yy'),
        Yy.stringify(objectYy),
      );
      await editYyOnDisk(project.yypPath, (yyp) => {
        yyp.resources.push({
          id: { name: 'o_external', path: 'objects/o_external/o_external.yy' },
        });
      });
      project.notifyChanged(project.yypPath);
      await project.renameAsset('sp_new', 'sp_renamed');
      const yy = await readYy(path.join(dir, 'o_external.yy'));
      assert.equal(yy.spriteId.name, 'sp_renamed');
    });

    it('serializes concurrent changes', async function () {
      const project = await openSandbox();
      const created = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          project.createScript(`Scripts/Many/scr_${i}`),
        ),
      );
      assert.equal(created.length, 10);
      const yyp = await readYy(project.yypPath);
      for (let i = 0; i < 10; i++) {
        assert.ok(yyp.resources.some((r: any) => r.id.name === `scr_${i}`));
      }
      await assertMatchesDisk(project, assert);
    });

    it('waits for git operations to finish', async function () {
      const project = await openSandbox();
      // Make the sandbox a "git repo" so the project looks for its lock
      await fs.mkdir(path.join(project.dir, '.git'));
      const watched = await GameMakerProject.open(project.dir, {
        changeDebounceMs: 10,
      });
      const events = recordEvents(watched);
      const lock = path.join(project.dir, '.git/index.lock');
      await fs.writeFile(lock, '');

      // A "pull" adds an asset while the lock is held
      await addScriptOnDisk(project.dir, project.yypPath, 'scr_pulled');
      watched.notifyChanged(project.yypPath);
      const creating = watched.createScript('Scripts/scr_during_pull');
      await sleep(300);
      assert.deepEqual(
        events.names(),
        [],
        'Processed changes during a git operation',
      );

      await fs.rm(lock);
      await creating;
      await watched.idle();
      assert.ok(watched.getAsset('scr_pulled'));
      assert.ok(watched.getAsset('scr_during_pull'));
      const names = (await readYy(project.yypPath)).resources.map(
        (r: any) => r.id.name,
      );
      assert.ok(
        names.includes('scr_pulled') && names.includes('scr_during_pull'),
      );
    });
  });

  describe('watching', function () {
    it('notices external changes', async function () {
      const project = await openSandbox();
      const stop = project.watch();
      try {
        const events = recordEvents(project);
        const script = project.requireAsset('Script1');
        await fs.appendFile(script.gmlFiles[0], '\n// edited');
        await waitFor(() => events.of('gmlChanged').length > 0);
        assert.deepEqual(events.of('gmlChanged')[0], [
          script,
          script.gmlFiles[0],
        ]);

        await addScriptOnDisk(project.dir, project.yypPath, 'scr_watched');
        await waitFor(() => !!project.getAsset('scr_watched'));
      } finally {
        stop();
      }
    });

    it('ignores its own changes', async function () {
      const project = await openSandbox();
      const stop = project.watch();
      try {
        const events = recordEvents(project);
        const script = await project.createScript('Scripts/scr_own', 'a = 1;');
        await project.createObjectEvent('o_object', 'Step_1');
        // Give the watcher time to report the writes
        await sleep(500);
        await project.idle();
        assert.deepEqual(
          events.names().filter((n) => n !== 'yypChanged'),
          ['assetAdded', 'assetChanged'],
        );
        assert.equal(events.of('assetAdded')[0][0], script);
      } finally {
        stop();
      }
    });
  });
});
