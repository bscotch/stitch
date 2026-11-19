import { describe, it } from 'node:test';
import { Yy } from '../Yy.ts';
import { yySoundSchema } from './YySound.ts';

describe('YySound', function () {
  it('can create a v2+ sound from sparse data', function () {
    const name = 'hello';
    Yy.stringify(
      {
        name,
        parent: {
          name: 'somewhere',
          path: 'folder/somewhere',
        },
        soundFile: 'soundFileName.wav',
        resourceVersion: '2.0',
      },
      yySoundSchema,
      { MetaData: { IDEVersion: '2024.1400.0.849' } } as any,
    );
  });
});
