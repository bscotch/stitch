import { GameMakerProject } from '@bscotch/gamemaker-project';
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { analyzeProject, listCodeDependencies } from './project.ts';

const sampleProject = path.resolve(
  import.meta.dirname,
  '../../parser/samples/project',
);

describe('listCodeDependencies', function () {
  it('lists references to other assets and their globals', async function () {
    const project = await GameMakerProject.open(sampleProject);
    const analyzer = await analyzeProject(project);
    const deps = listCodeDependencies(project, analyzer);
    // Script1 refers to the o_parent object by name
    assert.ok(
      deps.some(
        (d) =>
          d.requiredBy.name === 'Script1' &&
          d.requirement.name === 'o_parent' &&
          d.relationship === 'code',
      ),
    );
    // No asset depends on itself, and there are no duplicates
    assert.ok(deps.every((d) => d.requiredBy.name !== d.requirement.name));
    const keys = deps.map(
      (d) => `${d.requiredBy.name}/${d.requirement.name}/${d.symbol}`,
    );
    assert.equal(new Set(keys).size, keys.length);
  });
});
