import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ImportError, importAssets, planImport } from './import.ts';
import { assertMatchesDisk, openSandbox } from './test.lib.ts';
import { exists } from './util.ts';

describe('Importing assets', function () {
  it('refuses to import when dependencies are missing', async function () {
    const source = await openSandbox();
    const target = await openSandbox('target');
    await assert.rejects(
      () => importAssets(source, target, { sourceAsset: 'o_child1' }),
      (err) => {
        assert.ok(err instanceof ImportError);
        assert.deepEqual(
          [...new Set(err.missing.map((m) => m.requirement.name))],
          ['o_parent'],
        );
        return true;
      },
    );
    assert.equal(target.assetCount, 0);
  });

  it('imports missing dependencies when asked', async function () {
    const source = await openSandbox();
    const target = await openSandbox('target');
    const result = await importAssets(source, target, {
      sourceAsset: 'o_child1_child',
      onMissingDependency: 'include',
    });
    assert.deepEqual(result.created.sort(), [
      'o_child1',
      'o_child1_child',
      'o_parent',
    ]);
    assert.deepEqual(
      target.getAncestors('o_child1_child').map((a) => a.name),
      ['o_child1', 'o_parent'],
    );
    for (const asset of target.assets) {
      assert.ok(await exists(asset.yyPath));
      assert.equal(
        asset.gmlFiles.length,
        source.requireAsset(asset.name).gmlFiles.length,
      );
    }
    await assertMatchesDisk(target, assert);
  });

  it('imports folders into a different folder', async function () {
    const source = await openSandbox();
    const target = await openSandbox('target');
    const folder = source.requireAsset('Script1').folder;
    const { created } = await importAssets(source, target, {
      sourceFolder: folder,
      targetFolder: 'Imported/Stuff',
      kinds: ['scripts'],
      onMissingDependency: 'skip',
    });
    assert.ok(created.length > 0);
    for (const name of created) {
      assert.ok(target.requireAsset(name).isInFolder('Imported/Stuff'));
    }
    assert.ok(target.folders.includes('Imported/Stuff'));
  });

  it('replaces existing assets, unless told not to', async function () {
    const source = await openSandbox();
    const target = await openSandbox();
    const script = source.requireAsset('Script1');
    await fs.writeFile(script.gmlFiles[0], '// new version');
    const blocked = planImport(source, target, {
      sourceAsset: 'Script1',
      checkReplacement: () => 'Something needs the old one',
    });
    assert.equal(blocked.conflicts.length, 1);

    const { replaced } = await importAssets(source, target, {
      sourceAsset: 'Script1',
    });
    assert.deepEqual(replaced, ['Script1']);
    const updated = target.requireAsset('Script1');
    assert.equal(
      await fs.readFile(updated.gmlFiles[0], 'utf8'),
      '// new version',
    );
    assert.ok(!(await exists(`${updated.dir}.stitch-backup`)));
    assert.deepEqual(
      (await fs.readdir(path.dirname(updated.dir))).filter((d) =>
        d.includes('stitch'),
      ),
      [],
    );
  });

  it('refuses to replace an asset of a different kind', async function () {
    const source = await openSandbox();
    const target = await openSandbox('target');
    await target.createScript('Scripts/o_parent');
    const plan = planImport(source, target, { sourceAsset: 'o_parent' });
    assert.equal(plan.conflicts.length, 1);
  });
});
