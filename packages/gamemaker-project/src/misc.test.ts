import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  getEvent,
  getEventFromFilename,
  getEventFromLabel,
  objectEvents,
} from './objectEvents.ts';
import { summarizeSpine } from './spine.ts';
import { samplesDir } from './test.lib.ts';
import { folderPathToPosix } from './util.ts';

describe('Object events', function () {
  it('maps files, labels, and yy identifiers', function () {
    assert.equal(getEventFromFilename('Draw_64.gml')?.label, 'Draw GUI');
    assert.equal(getEventFromLabel('Draw GUI')?.name, 'Draw_64');
    assert.equal(getEvent(8, 64)?.name, 'Draw_64');
    assert.equal(objectEvents.filter((e) => e.group === 'user').length, 16);
    assert.equal(getEventFromLabel('User Event 15')?.name, 'Other_25');
  });

  it('supports events without a known label', function () {
    const keyPress = getEventFromFilename('KeyPress_32');
    assert.equal(keyPress?.eventType, 9);
    assert.equal(keyPress?.eventNum, 32);
    assert.equal(getEventFromFilename('Nonsense_1'), undefined);
    assert.equal(getEventFromFilename('Step_x'), undefined);
  });

  it('supports collision events', function () {
    const collision = getEventFromFilename('objects/o_a/Collision_o_wall.gml');
    assert.equal(collision?.collisionObject, 'o_wall');
    assert.equal(collision?.eventType, 4);
    assert.equal(
      getEventFromLabel('Collision (o_wall)')?.name,
      'Collision_o_wall',
    );
    assert.equal(getEvent(4, 0, 'o_wall')?.name, 'Collision_o_wall');
  });
});

describe('Spine', function () {
  it('summarizes Spine files', async function () {
    const summary = await summarizeSpine(
      path.join(samplesDir, 'sp_player_spine.json'),
    );
    assert.ok(summary.animations.length > 0);
    assert.ok(summary.animations.every((a) => a.duration >= 0));
    assert.ok(summary.skinNames.length > 0);
  });
});

describe('Utilities', function () {
  it('normalizes folder paths', function () {
    assert.equal(folderPathToPosix('folders/a/b.yy'), 'a/b');
    assert.equal(folderPathToPosix('\\a\\b\\'), 'a/b');
  });
});
