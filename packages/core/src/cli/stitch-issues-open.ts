import { default as inquirer } from 'inquirer';
import { StitchProject } from '../index.js';
import { GameMakerIssue } from '../lib/GameMakerIssue.js';
import {
  listIssueProjectChoices,
  openGameMakerIssue,
  openPaths,
} from './lib/issuesLib.js';
import { cli } from 'cli-forge';

export const openCommand = cli('open', {
  description: 'Open a GameMaker issue.',
  handler: async () => {
    const answers = await inquirer.prompt<{
      targetProject?: string;
    }>([
      {
        type: 'list',
        name: 'targetProject',
        message: 'Which Issue do you want to open?',
        async choices() {
          return [
            {
              name: '📁 Issues Folder',
              value: GameMakerIssue.issuesDirectory.toString({
                format: 'win32',
              }),
            },
            ...(await listIssueProjectChoices()),
          ];
        },
      },
    ]);

    if (!answers.targetProject) {
      process.exit(0);
    }

    if (answers.targetProject.endsWith('.yyp')) {
      const issueProject = await StitchProject.load({
        projectPath: answers.targetProject,
        dangerouslyAllowDirtyWorkingDir: true,
        readOnly: true,
      });

      await openGameMakerIssue(issueProject);
    } else {
      await openPaths([
        {
          path: answers.targetProject,
          app: { name: 'explorer' },
        },
      ]);
    }
  },
});
