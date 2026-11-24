import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { GameMakerProject } from './project.ts';
import {
  assertMatchesDisk,
  editYyOnDisk,
  openSandbox,
  readYy,
  recordEvents,
  samplesDir,
} from './test.lib.ts';
import { exists } from './util.ts';

const samplePng = path.join(
  samplesDir,
  'project/sprites/sp_new/17777d05-9cb0-4c1c-a77d-18a2bd4e69bd.png',
);

describe('GameMakerProject', function () {
  describe('loading', function () {
    it('loads every asset in the yyp', async function () {
      const project = await openSandbox();
      assert.equal(project.assetCount, project.yyp.resources.length);
      assert.equal(project.unloadedResources.length, 0);
      assert.equal(project.listAssets('objects').length, 6);
      assert.equal(project.listAssets('scripts').length, 9);
      assert.ok(project.ideVersion.match(/^\d+\./));
      assert.deepEqual(project.configs, ['Default']);
      assert.ok(project.folders.length > 0);
    });

    it('accepts the yyp path or its folder', async function () {
      const project = await openSandbox();
      const again = await GameMakerProject.open(project.yypPath);
      assert.equal(again.assetCount, project.assetCount);
    });

    it('finds GML files the way GameMaker does', async function () {
      const project = await openSandbox();
      const script = project.requireAsset('Script1', 'scripts');
      assert.equal(script.gmlFiles.length, 1);
      assert.match(script.gmlFiles[0], /Script1\.gml$/);

      const object = project.requireAsset('o_object', 'objects');
      assert.ok(object.gmlFiles.length > 0);
      // Only files for events listed in the yy, Create first
      const listed = object.listEvents().map((e) => e.event.name);
      assert.deepEqual(
        object.gmlFiles.map((f) => path.basename(f, '.gml')),
        listed.filter((name) =>
          object.gmlFiles.some((f) => path.basename(f, '.gml') === name),
        ),
      );
      if (listed.includes('Create_0')) {
        assert.match(object.gmlFiles[0], /Create_0\.gml$/);
      }
    });

    it('ignores GML files for events that are not in the yy', async function () {
      const project = await openSandbox();
      const object = project.requireAsset('o_object', 'objects');
      const orphan = path.join(object.dir, 'Step_2.gml');
      assert.ok(!(await exists(orphan)));
      await fs.writeFile(orphan, '// orphan');
      await project.reconcile([orphan]);
      assert.ok(!object.gmlFiles.includes(orphan));
      assert.ok(object.orphanedGmlFiles.includes(orphan));
    });
  });

  describe('queries', function () {
    it('looks up assets by name (case-insensitively) and by path', async function () {
      const project = await openSandbox();
      const object = project.requireAsset('o_object');
      assert.equal(project.getAsset('O_OBJECT'), object);
      assert.equal(project.getAssetByPath(object.yyPath), object);
      assert.equal(project.getAssetByPath(object.gmlFiles[0]), object);
      assert.equal(project.getAsset('nope'), undefined);
      assert.throws(() => project.requireAsset('o_object', 'sprites'));
    });

    it('follows object inheritance', async function () {
      const project = await openSandbox();
      const child = project.requireAsset('o_child1_child', 'objects');
      const ancestors = project.getAncestors(child).map((a) => a.name);
      assert.deepEqual(ancestors, ['o_child1', 'o_parent']);
      const children = project.getChildren('o_parent').map((a) => a.name);
      assert.deepEqual(children.sort(), ['o_child1', 'o_child2']);
    });

    it('includes room and instance creation code', async function () {
      const project = await openSandbox();
      const room = project.requireAsset('Room1', 'rooms');
      const [instance] = room.roomInstances;
      await editYyOnDisk(room.yyPath, (yy) => {
        yy.creationCodeFile = `${project.name}/rooms/Room1/RoomCreationCode.gml`;
        for (const layer of yy.layers) {
          for (const i of layer.instances || []) {
            if (i.name === instance.instanceId) i.hasCreationCode = true;
          }
        }
      });
      await fs.writeFile(path.join(room.dir, 'RoomCreationCode.gml'), '');
      const instanceCode = path.join(
        room.dir,
        `InstanceCreationCode_${instance.instanceId}.gml`,
      );
      await fs.writeFile(instanceCode, '');
      await project.reconcile([room.yyPath]);
      assert.deepEqual(room.gmlFiles, [
        path.join(room.dir, 'RoomCreationCode.gml'),
        instanceCode,
      ]);
      assert.equal(room.roomInstances[0].creationCodeFile, instanceCode);
    });

    it('lists room instances in creation order', async function () {
      const project = await openSandbox();
      const room = project.requireAsset('Room1', 'rooms');
      assert.ok(room.roomInstances.length > 0);
      assert.ok(
        room.roomInstances.every((i) => project.getAsset(i.objectName)),
      );
    });
  });

  describe('creating assets', function () {
    it('creates each kind of asset, writing yy, yyp, and files', async function () {
      const project = await openSandbox();
      const events = recordEvents(project);
      const script = await project.createScript(
        'Scripts/New/scr_new',
        'x = 1;',
      );
      const object = await project.createObject('Objects/o_new', {
        parent: 'o_parent',
        sprite: 'sp_new',
      });
      const sprite = await project.createSprite(
        'Sprites/sp_created',
        samplePng,
      );
      const sound = await project.createSound(
        'Sounds/sfx_new',
        path.join(samplesDir, 'sounds/sfx_collect_rise.wav'),
      );
      // Defaults from the Stitch config's sound rules (sfx_ sounds are mono)
      assert.equal((sound.yy as any).type, 0);
      await assert.rejects(() =>
        project.createSound(
          'Sounds/snd_bad',
          path.join(samplesDir, 'sounds/sfx_collect_rise.wav'),
        ),
      );
      const room = await project.createRoom('Rooms/rm_new');
      const shader = await project.createShader('Shaders/sh_new');

      assert.deepEqual(
        events.of('assetAdded').map(([a]) => a.name),
        ['scr_new', 'o_new', 'sp_created', 'sfx_new', 'rm_new', 'sh_new'],
      );
      assert.equal(await fs.readFile(script.gmlFiles[0], 'utf8'), 'x = 1;');
      assert.equal(script.folder, 'Scripts/New');
      assert.ok(project.folders.includes('Scripts/New'));
      assert.equal(object.parentName, 'o_parent');
      assert.equal(object.spriteName, 'sp_new');
      assert.match(object.gmlFiles[0], /Create_0\.gml$/);
      assert.equal(sprite.frameIds.length, 1);
      assert.ok(await exists(sprite.framePaths[0]));
      assert.ok(await exists(sound.soundFile!));
      assert.ok(
        project.yyp.RoomOrderNodes.some((n) => n.roomId.name === room.name),
      );
      assert.ok(await exists(shader.shaderPaths!.vertex));
      await assertMatchesDisk(project, assert);
    });

    it('creates assets at the project root', async function () {
      const project = await openSandbox();
      const script = await project.createScript('scr_root');
      assert.equal(script.folder, '');
      assert.equal((script.yy as any).parent.path, 'project.yyp');
    });

    it('adopts assets whose files were written by another tool', async function () {
      const project = await openSandbox();
      const source = project.requireAsset('Script1', 'scripts');
      const dir = path.join(project.dir, 'scripts', 'scr_adopted');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'scr_adopted.gml'), '');
      const yy = {
        ...(source.yy as any),
        name: 'scr_adopted',
        '%Name': 'scr_adopted',
      };
      await fs.writeFile(path.join(dir, 'scr_adopted.yy'), JSON.stringify(yy));
      const adopted = await project.adoptAsset(
        'scripts',
        'Adopted/Here/scr_adopted',
      );
      assert.equal(adopted.folder, 'Adopted/Here');
      assert.ok(project.folders.includes('Adopted/Here'));
      assert.ok(project.yyp.resources.some((r) => r.id.name === 'scr_adopted'));
      await assertMatchesDisk(project, assert);
      await assert.rejects(() =>
        project.adoptAsset('scripts', 'scr_does_not_exist'),
      );
    });

    it('refuses invalid or taken names', async function () {
      const project = await openSandbox();
      await assert.rejects(() => project.createScript('Scripts/Script1'));
      await assert.rejects(() => project.createScript('Scripts/SCRIPT1'));
      await assert.rejects(() => project.createScript('Scripts/1bad'));
      // Not even if the asset was added on disk but not yet noticed
      const yypBefore = await fs.readFile(project.yypPath, 'utf8');
      await project.createScript('Scripts/scr_a');
      const other = await GameMakerProject.open(project.yypPath);
      await other.createScript('Scripts/scr_b');
      await assert.rejects(() => project.createScript('Scripts/scr_b'));
      assert.notEqual(await fs.readFile(project.yypPath, 'utf8'), yypBefore);
    });

    it('duplicates assets, giving room instances new IDs', async function () {
      const project = await openSandbox();
      const original = project.requireAsset('Room1', 'rooms');
      const copy = await project.duplicateAsset(original, 'Rooms/Room2');
      assert.equal(copy.yy.name, 'Room2');
      assert.equal(copy.roomInstances.length, original.roomInstances.length);
      const originalIds = new Set(
        original.roomInstances.map((i) => i.instanceId),
      );
      assert.ok(
        copy.roomInstances.every((i) => !originalIds.has(i.instanceId)),
      );
      assert.ok(
        project.yyp.RoomOrderNodes.some((n) => n.roomId.name === 'Room2'),
      );
      const script = await project.duplicateAsset('Script1', 'Script1Copy');
      assert.equal(script.folder, project.requireAsset('Script1').folder);
      assert.match(script.gmlFiles[0], /Script1Copy\.gml$/);
      await assertMatchesDisk(project, assert);
    });
  });

  describe('renaming assets', function () {
    it('renames an object and every yy reference to it', async function () {
      const project = await openSandbox();
      const other = await project.createObject('Objects/o_other');
      await project.createObjectEvent(other, 'Collision_o_parent');
      const room = project.requireAsset('Room1', 'rooms');
      await project.addRoomInstance(room, 'o_parent', { x: 5, y: 6 });
      const events = recordEvents(project);

      const renamed = await project.renameAsset('o_parent', 'o_base');
      assert.deepEqual(
        events.of('assetRemoved').map(([a]) => a.name),
        ['o_parent'],
      );
      assert.ok(events.of('assetAdded').some(([a]) => a.name === 'o_base'));
      assert.equal(project.getAsset('o_parent'), undefined);
      assert.equal(renamed.yy.name, 'o_base');
      assert.ok(!(await exists(path.join(project.dir, 'objects/o_parent'))));
      assert.ok(await exists(renamed.yyPath));
      // Children
      assert.deepEqual(
        project
          .getChildren(renamed)
          .map((c) => c.name)
          .sort(),
        ['o_child1', 'o_child2'],
      );
      // Collision events (and their files)
      const otherNow = project.requireAsset('o_other', 'objects');
      assert.ok(otherNow.getEventFile('Collision_o_base'));
      assert.ok(
        !(await exists(path.join(otherNow.dir, 'Collision_o_parent.gml'))),
      );
      // Rooms
      assert.ok(
        project
          .requireAsset('Room1', 'rooms')
          .roomInstances.some((i) => i.objectName === 'o_base'),
      );
      await assertMatchesDisk(project, assert);
    });

    it('renames sprites, updating objects that use them', async function () {
      const project = await openSandbox();
      const object = await project.createObject('Objects/o_s', {
        sprite: 'sp_new',
      });
      await project.renameAsset('sp_new', 'sp_renamed');
      assert.equal(object.spriteName, 'sp_renamed');
      const sprite = project.requireAsset('sp_renamed', 'sprites');
      assert.equal((sprite.yy as any).sequence.name, 'sp_renamed');
      assert.ok(sprite.framePaths.every((f) => f.includes('sp_renamed')));
      await assertMatchesDisk(project, assert);
    });

    it('handles case-only renames', async function () {
      const project = await openSandbox();
      const renamed = await project.renameAsset('Script1', 'SCRIPT1');
      assert.equal(renamed.name, 'SCRIPT1');
      assert.match(renamed.gmlFiles[0], /SCRIPT1[\\/]SCRIPT1\.gml$/);
      const listed = project.yyp.resources.find((r) => r.id.name === 'SCRIPT1');
      assert.equal(listed?.id.path, 'scripts/SCRIPT1/SCRIPT1.yy');
      assert.ok(
        (await fs.readdir(path.join(project.dir, 'scripts'))).includes(
          'SCRIPT1',
        ),
      );
      await assertMatchesDisk(project, assert);
    });

    it('rolls back if something fails', async function () {
      const project = await openSandbox();
      const before = await fs.readFile(project.yypPath, 'utf8');
      await assert.rejects(() =>
        project.transaction(async (tx) => {
          await tx.copyDir(
            project.requireAsset('Script1').dir,
            path.join(project.dir, 'scripts/Partial'),
          );
          (await tx.yyp()).resources.push({
            id: { name: 'Partial', path: 'scripts/Partial/Partial.yy' },
          });
          throw new Error('Boom');
        }),
      );
      assert.equal(await fs.readFile(project.yypPath, 'utf8'), before);
      assert.ok(!(await exists(path.join(project.dir, 'scripts/Partial'))));
    });
  });

  describe('deleting assets', function () {
    it('deletes an object and cleans up references to it', async function () {
      const project = await openSandbox();
      const other = await project.createObject('Objects/o_other');
      await project.createObjectEvent(other, 'Collision_o_parent');
      await project.addRoomInstance('Room1', 'o_parent');
      const dir = project.requireAsset('o_parent').dir;

      const { danglingReferences } = await project.deleteAsset('o_parent');
      assert.deepEqual(danglingReferences, []);
      assert.equal(project.getAsset('o_parent'), undefined);
      assert.ok(!(await exists(dir)));
      assert.equal(project.requireAsset('o_child1').parentName, undefined);
      assert.ok(!other.listEvents().some((e) => e.event.collisionObject));
      assert.ok(
        !(await exists(path.join(other.dir, 'Collision_o_parent.gml'))),
      );
      assert.ok(
        project
          .requireAsset('Room1', 'rooms')
          .roomInstances.every((i) => i.objectName !== 'o_parent'),
      );
      await assertMatchesDisk(project, assert);
    });

    it('removes deleted rooms from the room order', async function () {
      const project = await openSandbox();
      await project.createRoom('Rooms/rm_temp');
      await project.deleteAsset('rm_temp');
      assert.ok(
        !project.yyp.RoomOrderNodes.some((n) => n.roomId.name === 'rm_temp'),
      );
    });
  });

  describe('folders', function () {
    it('creates, renames and deletes folders', async function () {
      const project = await openSandbox();
      await project.createFolder('A/B/C');
      assert.ok(
        ['A', 'A/B', 'A/B/C'].every((f) => project.folders.includes(f)),
      );
      const script = await project.createScript('A/B/scr_in_b');
      const deep = await project.createScript('A/B/C/scr_in_c');

      const { movedAssets } = await project.renameFolder('A/B', 'X/Y');
      assert.deepEqual(movedAssets.map((a) => a.name).sort(), [
        'scr_in_b',
        'scr_in_c',
      ]);
      assert.equal(script.folder, 'X/Y');
      assert.equal(deep.folder, 'X/Y/C');
      assert.ok(project.folders.includes('X/Y/C'));
      assert.ok(!project.folders.some((f) => f.startsWith('A/B')));

      await assert.rejects(() => project.deleteFolder('X'));
      await project.moveAsset(script, 'Scripts');
      await project.moveAsset(deep, 'Scripts');
      await project.deleteFolder('X');
      assert.ok(!project.folders.some((f) => f === 'X' || f.startsWith('X/')));
      await assertMatchesDisk(project, assert);
    });

    it('refuses to move a folder into itself', async function () {
      const project = await openSandbox();
      await project.createFolder('A/B');
      await assert.rejects(() => project.renameFolder('A', 'A/B/A'));
    });
  });

  describe('objects', function () {
    it('creates and deletes events', async function () {
      const project = await openSandbox();
      const object = await project.createObject('Objects/o_events');
      const events = recordEvents(project);
      const step = await project.createObjectEvent(object, 'Step');
      assert.match(step, /Step_0\.gml$/);
      assert.ok(object.gmlFiles.includes(step));
      const [, change] = events.of('assetChanged')[0];
      assert.deepEqual(change.gmlFilesAdded, [step]);

      await project.createObjectEvent(object, 'User Event 15');
      assert.ok(object.getEventFile('Other_25'));
      await project.deleteObjectEvent(object, 'Step_0');
      assert.ok(!object.gmlFiles.includes(step));
      assert.ok(!(await exists(step)));
    });

    it('sets parents and sprites, refusing cycles', async function () {
      const project = await openSandbox();
      await project.setObjectParent('o_object', 'o_child1');
      assert.equal(project.requireAsset('o_object').parentName, 'o_child1');
      await assert.rejects(() =>
        project.setObjectParent('o_parent', 'o_child1_child'),
      );
      await project.setObjectParent('o_object', undefined);
      assert.equal(project.requireAsset('o_object').parentName, undefined);
      await project.setObjectSprite('o_object', 'sp_new');
      assert.equal(project.requireAsset('o_object').spriteName, 'sp_new');
    });
  });

  describe('rooms', function () {
    it('adds, reorders and removes instances', async function () {
      const project = await openSandbox();
      const room = project.requireAsset('Room1', 'rooms');
      const before = room.roomInstances.map((i) => i.instanceId);
      const id = await project.addRoomInstance(room, 'o_object', {
        x: 10,
        y: 20,
      });
      assert.deepEqual(room.roomInstances.at(-1), {
        instanceId: id,
        objectName: 'o_object',
        layerName: room.roomInstances.at(-1)!.layerName,
        x: 10,
        y: 20,
        creationCodeFile: undefined,
      });
      await project.reorderRoomInstances(room, [id, ...before]);
      assert.equal(room.roomInstances[0].instanceId, id);
      await assert.rejects(() => project.reorderRoomInstances(room, [id]));
      await project.removeRoomInstance(room, id);
      assert.deepEqual(
        room.roomInstances.map((i) => i.instanceId),
        before,
      );
    });
  });

  describe('sprites', function () {
    it('adds, reorders and deletes frames', async function () {
      const project = await openSandbox();
      const sprite = project.requireAsset('sp_new', 'sprites');
      const original = sprite.frameIds;
      await project.addSpriteFrames(sprite, [samplePng, samplePng]);
      assert.equal(sprite.frameIds.length, original.length + 2);
      assert.ok(
        (await Promise.all(sprite.framePaths.map(exists))).every(Boolean),
      );
      const yy = await readYy(sprite.yyPath);
      assert.equal(
        yy.sequence.tracks[0].keyframes.Keyframes.length,
        sprite.frameIds.length,
      );
      const reversed = [...sprite.frameIds].reverse();
      await project.reorderSpriteFrames(sprite, reversed);
      assert.deepEqual(sprite.frameIds, reversed);
      const [removed] = sprite.frameIds;
      await project.deleteSpriteFrames(sprite, [removed]);
      assert.ok(!sprite.frameIds.includes(removed));
      assert.ok(!(await exists(path.join(sprite.dir, `${removed}.png`))));
    });
  });

  describe('project settings', function () {
    it('syncs included files with the datafiles folder', async function () {
      const project = await openSandbox();
      await fs.mkdir(path.join(project.dir, 'datafiles/sub'), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(project.dir, 'datafiles/sub/data.json'),
        '{}',
      );
      await project.syncIncludedFiles();
      assert.ok(
        project.includedFiles.some(
          (f) => f.name === 'data.json' && f.filePath === 'datafiles/sub',
        ),
      );
    });

    it('sets the IDE version', async function () {
      const project = await openSandbox();
      await project.setIdeVersion('2024.1.2.3');
      assert.equal(project.ideVersion, '2024.1.2.3');
      assert.equal(
        (await readYy(project.yypPath)).MetaData.IDEVersion,
        '2024.1.2.3',
      );
    });
  });
});
