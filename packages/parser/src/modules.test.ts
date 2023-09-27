import { pathy } from '@bscotch/pathy';
import { expect } from 'chai';
import { computeAssetDeps, importAssets } from './modules.js';
import { Project } from './project.js';
import { assert } from './util.js';
import { assertThrowsAsync } from './util.test.js';

async function resetSandbox() {
  for (const dir of ['target']) {
    const srcDir = pathy('samples').join(dir);
    const destDir = pathy('sandbox').join(dir);
    await destDir.rm({ recursive: true, maxRetries: 5 });
    await destDir.ensureDir();
    await srcDir.copy(destDir);
  }

  const targetProject = await Project.initialize('sandbox/target');
  assert(targetProject);
  return targetProject;
}

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
      o_object_deps[0].requiredBy.name === 'o_object',
      'o_object deps are wrong',
    );
  });

  it('can perform a simple import', async function () {
    let targetProject = await resetSandbox();
    const project = await Project.initialize('samples/project');
    assert(project);

    await assertThrowsAsync(async () => {
      await importAssets(project, targetProject, {
        sourceAsset: 'o_child1_child',
      });
    }, 'Missing dependency not caught');

    await importAssets(project, targetProject, {
      sourceAsset: 'o_child1_child',
      onMissingDependency: 'skip',
    });
    expect(targetProject.getAssetByName('o_child1_child')).to.exist;

    targetProject = await resetSandbox();

    await importAssets(project, targetProject, {
      sourceAsset: 'o_child1_child',
      onMissingDependency: 'include',
    });
    expect(targetProject.getAssetByName('o_child1_child')).to.exist;
    expect(targetProject.getAssetByName('o_child1')).to.exist;
    expect(targetProject.getAssetByName('o_parent')).to.exist;
  });

  xit('can identify import conflicts', async function () {
    // TODO: Add a "conflicted-target" project that has the various sorts of conflicts we can test against.
  });
});
