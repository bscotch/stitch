#!/usr/bin/env node
import { default as inquirer } from 'inquirer';
import { StitchProject } from '../index.js';
import { listIssueProjectChoices, openPaths } from './lib/issuesLib.js';
import { cli } from 'cli-forge';

export const submitCommand = cli('submit', {
  description: 'Submit a GameMaker issue.',
  handler: async () => {
    const answers = await inquirer.prompt<{
      targetProject?: string;
    }>([
      {
        type: 'list',
        name: 'targetProject',
        message: 'Which Issue do you want to submit?',
        async choices() {
          return await listIssueProjectChoices();
        },
      },
    ]);

    if (!answers.targetProject) {
      process.exit(0);
    }

    const issueProject = await StitchProject.load({
      projectPath: answers.targetProject,
      dangerouslyAllowDirtyWorkingDir: true,
      readOnly: true,
    });

    await issueProject.issue.collectLogs();

    const report = await issueProject.issue.compileReport();

    await openPaths([
      {
        path: issueProject.issue.attachmentsDirectory.toString({
          format: 'win32',
        }),
        app: { name: 'explorer' },
      },
      report.mailTo,
    ]);
  },
});
