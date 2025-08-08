import { Yy } from '../Yy.js';
import { yySoundSchema } from './YySound.js';

describe('YySound', function () {
  it('can create a v2+ sound from sparse data', function () {
    const name = 'hello';
    const asString = Yy.stringify(
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
