import { yySoundSchema } from './YySound.js';

describe('YySound', function () {
  it('can create a v2+ sound from sparse data', function () {
    const name = 'hello';
    yySoundSchema.parse({
      name,
      parent: {
        name: 'somewhere',
        path: 'folder/somewhere',
      },
      soundFile: 'soundFileName.wav',
      resourceVersion: '2.0',
    });
  });
});
