import { pathy } from '@bscotch/pathy';
import { expect } from 'chai';
import { Spine } from './spine.js';

const sampleFile = pathy('samples/sp_player_spine.json');

describe('Spine', function () {
  it('can summarize a Spine JSON file', async function () {
    const spine = new Spine(sampleFile);
    const summary = await spine.summarize();

    const expectedSummary = {
      skinNames: ['default'],
      eventNames: [
        'anticipation',
        'attackbegin',
        'flash_35_255_255_1',
        'hit',
        'hold',
        'sfx_swing_hardlight',
        'sfx_swing_medium',
        'sfx_swing_metal_heavy',
        'sfx_swing_metal_light',
        'sfx_swing_physical',
        'swing_sound',
      ],
      animations: [
        {
          name: 'attack_sword_0',
          duration: 0.6667,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.2333,
              name: 'attackbegin',
            },
            {
              time: 0.4,
              name: 'hit',
            },
            {
              time: 0.4,
              name: 'swing_sound',
            },
          ],
        },
        {
          name: 'attack_sword_1',
          duration: 0.6833,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.2333,
              name: 'attackbegin',
            },
            {
              time: 0.4167,
              name: 'hit',
            },
            {
              time: 0.4167,
              name: 'swing_sound',
            },
          ],
        },
        {
          name: 'attack_sword_2',
          duration: 0.7167,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.2167,
              name: 'attackbegin',
            },
            {
              time: 0.3667,
              name: 'hit',
            },
            {
              time: 0.3667,
              name: 'sfx_swing_physical',
            },
          ],
        },
        {
          name: 'buildmode_idle',
          duration: 1.5,
          events: [],
        },
        {
          name: 'buildmode_recoil',
          duration: 0.3333,
          events: [
            {
              name: 'anticipation',
            },
            {
              time: 0.3,
              name: 'attackbegin',
            },
            {
              time: 0.3167,
              name: 'hit',
            },
          ],
        },
        {
          name: 'fishing_idle',
          duration: 1.5,
          events: [
            {
              name: 'anticipation',
            },
            {
              time: 0.0167,
              name: 'attackbegin',
            },
            {
              time: 1.4833,
              name: 'hit',
            },
          ],
        },
        {
          name: 'fishing_idle_whopper',
          duration: 2.1,
          events: [],
        },
        {
          name: 'fishing_yank',
          duration: 0.2667,
          events: [],
        },
        {
          name: 'harvest_choppa_0',
          duration: 0.65,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.1833,
              name: 'attackbegin',
            },
            {
              time: 0.3833,
              name: 'hit',
            },
            {
              time: 0.3833,
              name: 'swing_sound',
            },
          ],
        },
        {
          name: 'harvest_choppa_1',
          duration: 0.5333,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.2333,
              name: 'attackbegin',
            },
            {
              time: 0.2667,
              name: 'hit',
            },
            {
              time: 0.2667,
              name: 'swing_sound',
            },
          ],
        },
        {
          name: 'harvest_choppa_2',
          duration: 0.7,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.1333,
              name: 'attackbegin',
            },
            {
              time: 0.2667,
              name: 'hit',
            },
            {
              time: 0.2667,
              name: 'swing_sound',
            },
          ],
        },
        {
          name: 'holster_weapon',
          duration: 0.1667,
          events: [],
        },
        {
          name: 'idle',
          duration: 1.4833,
          events: [],
        },
        {
          name: 'interact_0',
          duration: 0.5833,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.0333,
              name: 'attackbegin',
            },
            {
              time: 0.25,
              name: 'hit',
            },
            {
              time: 0.25,
              name: 'swing_sound',
            },
          ],
        },
        {
          name: 'interact_1',
          duration: 0.5833,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.0333,
              name: 'attackbegin',
            },
            {
              time: 0.25,
              name: 'hit',
            },
            {
              time: 0.25,
              name: 'swing_sound',
            },
          ],
        },
        {
          name: 'interact_2',
          duration: 0.5833,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.0333,
              name: 'attackbegin',
            },
            {
              time: 0.2333,
              name: 'hit',
            },
            {
              time: 0.2333,
              name: 'swing_sound',
            },
          ],
        },
        {
          name: 'juke_0',
          duration: 0.25,
          events: [],
        },
        {
          name: 'juke_1',
          duration: 0.25,
          events: [
            {
              name: 'hold',
            },
          ],
        },
        {
          name: 'levitate',
          duration: 2,
          events: [],
        },
        {
          name: 'lob',
          duration: 0.5,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.1167,
              name: 'attackbegin',
            },
            {
              time: 0.1667,
              name: 'swing_sound',
            },
            {
              time: 0.2667,
              name: 'hit',
            },
          ],
        },
        {
          name: 'run',
          duration: 0.5,
          events: [
            {
              time: 0.15,
              name: 'hold',
            },
            {
              time: 0.4,
              name: 'hold',
            },
          ],
        },
        {
          name: 'run2discord',
          duration: 0.5,
          events: [
            {
              time: 0.15,
              name: 'hold',
            },
            {
              time: 0.4,
              name: 'hold',
            },
          ],
        },
        {
          name: 'run_transition',
          duration: 0.0833,
          events: [],
        },
        {
          name: 'sit',
          duration: 1.5,
          events: [],
        },
        {
          name: 'throw',
          duration: 0.5,
          events: [
            {
              time: 0.0167,
              name: 'anticipation',
            },
            {
              time: 0.0333,
              name: 'attackbegin',
            },
            {
              time: 0.2667,
              name: 'hit',
            },
            {
              time: 0.2667,
              name: 'swing_sound',
            },
          ],
        },
        {
          name: 'trophy',
          duration: 1,
          events: [],
        },
      ],
    };
    expect(summary).to.eql(expectedSummary);
  });
});
