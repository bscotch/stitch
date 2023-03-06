import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Gms2Project from '../index.js';
import { Gms2Object } from '../lib/components/resources/Gms2Object.js';
import { gameMakerIssueSchema } from '../lib/GameMakerIssue.constants.js';
import { GameMakerIssue } from '../lib/GameMakerIssue.js';
import { loadCleanProject, resetTempDir } from './lib/util.js';

chai.use(chaiAsPromised);
const expect = chai.expect;

/**
 * TODO:
  * - You run a CLI command `stitch issue create`
    - ✅ A new folder is created in the current project
    - ✅ A YAML file describing the issue is created and pre-populated as much as possible
    - ❌ Open the YAML file in the default editor (encourage people to use VSCode)
  - You then open that YAML file and add additional information, specify what to export from the source project, etc
  - You then run `stitch issue update`, which:
    - ✅ Makes a zip of the current project, added to the issue folder
    - ✅ Grabs the latest logs from the ui
    - ✅ Runs the project and collections compile + project logs
      - 🔜 Parses the compiler logs to identify the part that is from the running game, separating that into a separate file.
    - ✅ Grabs latest GameMaker IDE/runtime version info
    - 🔜 Composes an issue for submission
 */

const sampleIssueName = 'issue-test';

describe('GameMaker Issues', function () {
  it('can clone a project', async function () {
    const outDir = await resetTempDir('clone-project');
    const cloned = await Gms2Project.cloneProject({
      templatePath: Gms2Project.defaultProjectTemplatePath,
      name: 'New Name',
      where: outDir.absolute,
    });
    expect(cloned.name).to.equal('New Name');
  });

  it('can manage an issue form', async function () {
    const project = await loadCleanProject(sampleIssueName, {
      readonly: true,
    });

    const issue = project.issue;

    // Create the form
    expect(issue.formPath.existsSync(), 'Should not yet have a form file').to.be
      .false;
    await project.issue.updateForm({ type: 'ide' });
    expect(issue.formPath.existsSync(), 'Should have created the issue file').to
      .be.true;
    const issueSchemaContent = await GameMakerIssue.formSchemaPath.read();
    expect(
      issueSchemaContent,
      'Should have the correct issue schema.',
    ).to.deep.equal(gameMakerIssueSchema);
  });

  xit('can manage a project issue', async function () {
    this.timeout(0);

    const cases = [
      {
        compilerSucceeded: false,
        runnerSucceeded: undefined,
      },
      {
        compilerSucceeded: true,
        runnerSucceeded: true,
      },
      {
        compilerSucceeded: true,
        runnerSucceeded: false,
      },
    ];

    for (const testCase of cases) {
      const project = await loadCleanProject(sampleIssueName, {
        readonly: false,
      });

      const entrypointObject = project.resources.findByName(
        'object',
        Gms2Object,
      );
      const entrypointEvent = entrypointObject!.findEvent('Create')!;

      if (testCase.compilerSucceeded === false) {
        entrypointEvent.code += '\nTHIS WILL BREAK THE COMPILER';
      } else if (testCase.runnerSucceeded === false) {
        entrypointEvent.code += '\nvar whatever = "hello" + 1;';
      }

      const issue = project.issue;

      await expect(issue.collectLogs(), 'Should throw validation error').to.be
        .rejected;

      const updateResult = await issue.collectLogs({
        skipTemplateValidation: true,
      });

      if (testCase.compilerSucceeded === false) {
        expect(updateResult.compileSucceeded).to.be.false;
        expect(updateResult.runnerSucceeded).to.be.undefined;
      } else if (testCase.runnerSucceeded === false) {
        expect(updateResult.compileSucceeded).to.be.true;
        expect(updateResult.runnerSucceeded).to.be.false;
      } else {
        expect(updateResult.compileSucceeded).to.be.true;
        expect(updateResult.runnerSucceeded).to.be.true;
      }

      // Ensure all files we expect to exist were created
      const expectedFiles = [
        'attachments/' + project.name + '.yyz',
        'attachments/ui.log',
        'environment.yaml',
        'attachments/compiler.txt',
        ...(testCase.compilerSucceeded ? ['attachments/runner.txt'] : []),
      ];
      for (const file of expectedFiles) {
        const filePath = issue.directory.join(file);
        expect(await filePath.exists(), `Should have created the ${file}`).to.be
          .true;
      }

      // Populate the mailto link
      const issueForm = issue.formPath;
      await issueForm.write({
        affected: ['Feather'],
        description: 'This is a test',
        platforms: ['Windows'],
        summary: 'Test Issue',
        type: 'ide',
      });
      const mailTo = (
        await issue.compileReport({
          cc: 'gamemaker-issues@bscotch.net',
          from: 'adam@butterscotch-shenanigans.com',
        })
      ).mailTo;
      expect(mailTo).to.match(/^mailto:/);
    }
  });
});
