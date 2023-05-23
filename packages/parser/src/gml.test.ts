import { ProjectTypes } from './project.impl.js';

describe('GML', function () {
  it('can load the GML spec', async function () {
    const spec = await ProjectTypes.from();
  });
});
