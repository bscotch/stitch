import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeAssetDeps, importAssets } from './modules.ts';
import { Project } from './project.ts';
import { resetSandbox } from './test.lib.ts';
import { assertThrowsAsync } from './util.test.ts';

describe('Modules', function () {
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
    const targetProject = await resetSandbox();
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
    assert.ok(targetProject.getAssetByName('o_child1_child') != null);
  });

  it('can perform a deep import', async function () {
    const targetProject = await resetSandbox();
    const project = await Project.initialize('samples/project');
    assert(project);

    const results = await importAssets(project, targetProject, {
      sourceAsset: 'o_child1_child',
      onMissingDependency: 'include',
    });
    assert.equal(results.errors.length, 0);
    assert.equal(results.skipped.length, 0);
    assert.equal(results.updated.length, 0);
    assert.equal(results.created.length, 3);
    assert.ok(targetProject.getAssetByName('o_child1_child') != null);
    assert.ok(targetProject.getAssetByName('o_child1') != null);
    assert.ok(targetProject.getAssetByName('o_parent') != null);
  });

  it.skip('can identify import conflicts', async function () {
    // TODO: Add a "conflicted-target" project that has the various sorts of conflicts we can test against.
  });
});
