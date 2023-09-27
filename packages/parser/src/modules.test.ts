import { computeAssetDeps } from './modules.js';
import { Project } from './project.js';
import { assert } from './util.js';

describe.only('Modules', function () {
  it('can compute intra-project dependencies', async function () {
    const projectDir = 'samples/project';
    const project = await Project.initialize(projectDir);
    assert(project);

    const deps = computeAssetDeps(project);
    assert(deps.size > 0, 'No dependencies found');

    // o_object refers to a lot of stuff
    const o_object = [...deps.keys()].find((a) => a.name === 'o_object');
    assert(o_object, 'o_object not found');
    const o_object_deps = deps.get(o_object);
    assert(o_object_deps, 'o_object deps not found');
    assert(o_object_deps.length > 0, 'o_object has no deps');
    assert(
      o_object_deps[0].requiredByAsset.name === 'o_object',
      'o_object deps are wrong',
    );
  });
});
