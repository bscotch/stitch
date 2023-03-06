import { expect } from 'chai';
import { differenceBy } from 'lodash-es';
import { StitchProject } from '../lib/StitchProject.js';
import fs from '../utility/files.js';
import paths from '../utility/paths.js';
import { loadCleanProject, modulesRoot, throwNever } from './lib/util.js';

describe('GameMaker Project Merge', function () {
  it('can import modules from one project into another', async function () {
    const targetProject = await loadCleanProject('merge', { readonly: true });
    const ifFolderMatches = ['BscotchPack', 'AnotherModule'];

    // Initial state
    const project = await StitchProject.load({
      projectPath: targetProject.yypDirAbsolute,
      dangerouslyAllowDirtyWorkingDir: true,
    });
    const resourcesToImport = targetProject.resources
      .filter((resource) => {
        return ifFolderMatches.some((match) => resource.folder.includes(match));
      })
      .map((resource) => resource.toJSON());
    expect(
      project.configs.findChild('BscotchPack'),
      'BscotchPack config should not exist before import',
    ).to.not.exist;

    // IMPORT
    await project.merge(modulesRoot, { ifFolderMatches });

    // Check Resources
    const unexported = differenceBy(
      project.resources.toJSON(),
      resourcesToImport,
      'name',
    );
    expect(
      unexported.length,
      'every module asset should have been imported',
    ).to.equal(0);

    // Check IncludedFiles
    expect(
      project.configs.findChild('BscotchPack'),
      'BscotchPack config should be imported',
    ).to.exist;
    const resourceData = project.includedFiles.findByField(
      'name',
      'moduleFile.txt',
    );
    if (!resourceData) {
      console.log('included file should be imported');
      throwNever();
    }
    const datafileDir = paths.join(
      project.yypDirAbsolute,
      resourceData.toJSON().filePath,
    );
    expect(
      fs.existsSync(datafileDir),
      'The imported files should exist in the actual datafiles path',
    );

    // IMPORT AGAIN to trigger no-overwrite-if-same checks
    await project.merge(modulesRoot, { ifFolderMatches });
  });

  it('can whitelist asset types to import', async function () {
    const targetProject = await loadCleanProject('merge', { readonly: true });
    const sourceProject = await StitchProject.load({
      readOnly: true,
      projectPath: modulesRoot,
      dangerouslyAllowDirtyWorkingDir: true,
    });
    const initialResources = targetProject.resources.all;
    const sourceObjects = sourceProject.resources.objects;
    const finalResources = (
      await targetProject.merge(modulesRoot, {
        types: ['objects'],
      })
    ).resources.all;
    const addedResources = differenceBy(
      finalResources,
      initialResources,
      'name',
    );
    expect(sourceObjects.map((o) => o.name)).to.eql(
      addedResources.map((o) => o.name),
    );
  });

  it('can import *all* assets from a project', async function () {
    const project = await loadCleanProject('merge', { readonly: true });

    await project.merge(modulesRoot);

    // Check IncludedFiles
    expect(
      project.configs.findChild('BscotchPack'),
      'BscotchPack config should be imported',
    ).to.exist;
    const resourceData = project.includedFiles.findByField(
      'name',
      'moduleFile.txt',
    );
    if (!resourceData) {
      console.log('included file should be imported');
      throwNever();
    }
    const datafileDir = paths.join(
      project.yypDirAbsolute,
      resourceData.toJSON().filePath,
    );
    expect(
      fs.existsSync(datafileDir),
      'The imported files should exist in the actual datafiles path',
    );
  });
});
