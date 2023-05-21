import { Gml } from './project.impl.js';

describe.only('GML', function () {
  it('can load the GML spec', async function () {
    const spec = await Gml.from();
  });
});
