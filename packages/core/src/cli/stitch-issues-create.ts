#!/usr/bin/env node
import { Pathy } from '@bscotch/pathy';
import { paramCase } from 'change-case';
import { default as inquirer } from 'inquirer';
import Gms2Project from '../index.js';
import {
  issueAffectedAreaOptions,
  issueAffectedPlatforms,
  issueTypes,
} from '../lib/GameMakerIssue.constants.js';
import { GameMakerIssue } from '../lib/GameMakerIssue.js';
import { GameMakerIssueForm } from '../lib/GameMakerIssue.types.js';
import {
  listIssueProjectChoices,
  listLocalProjectChoices,
  openGameMakerIssue,
} from './lib/issuesLib.js';

const answers = await inquirer.prompt<
  {
    name?: string;
    allPlatforms?: boolean;
    template: string;
    newTemplate?: string;
  } & GameMakerIssueForm
>([
  {
    type: 'input',
    name: 'summary',
    message: 'Title for the issue (short, precise, and descriptive)',
    validate(value: string) {
      return value?.length < 128
        ? true
        : 'Title must be less than 128 characters';
    },
  },
  {
    type: 'input',
    name: 'description',
    message:
      'Fully describe the issue, including information about replication and context.',
  },
  {
    type: 'list',
    name: 'type',
    message: 'What type of issue is this?',
    choices: Object.entries(issueTypes).map((entry) => ({
      name: entry[1],
      value: entry[0],
    })),
  },
  {
    type: 'checkbox',
    name: 'affected',
    message: 'What features are impacted?',

    choices(answers) {
      return issueAffectedAreaOptions[answers.type];
    },
  },
  {
    type: 'checkbox',
    name: 'platforms',
    when(answers) {
      return !answers.allPlatforms;
    },
    message: 'Which platforms are affected?',
    choices: issueAffectedPlatforms,
    validate(value: string[]) {
      return value.length > 0 ? true : 'You must select at least one platform';
    },
    default: issueAffectedPlatforms,
  },
  {
    type: 'list',
    name: 'template',
    message: 'Choose a template to clone for this issue.',
    async choices() {
      const templates = [
        new inquirer.Separator('\n--- Templates ---'),
        // Add the default template, shipped with the package
        {
          name: "🚀 Use Stitch's template",
          value: Gms2Project.defaultProjectTemplatePath,
        },
        // Add an option to specify a custom template
        {
          name: '🆕 Use a new template',
          value: '',
        },
        new inquirer.Separator('\n--- Existing Issues ---'),
        ...(await listIssueProjectChoices()),
        new inquirer.Separator('\n--- Local Projects ---'),
        ...(await listLocalProjectChoices()),
      ];
      return templates;
    },
  },
  {
    type: 'input',
    name: 'newTemplate',
    message: 'Enter the path to the template to use',
    when(answers) {
      return answers.template === '';
    },
    validate(value: string) {
      const templatePath = new Pathy(value);
      return templatePath.existsSync() ? true : 'Template does not exist';
    },
  },
  {
    type: 'input',
    name: 'name',
    message: 'Name the new GameMaker project:',
    async validate(name: string) {
      // Make sure it won't clobber
      if (name.length === 0) {
        return 'You must enter a name!';
      }
      return (await GameMakerIssue.issuesDirectory
        .join(paramCase(name))
        .isEmptyDirectory({ allowNotFound: true }))
        ? true
        : 'An issue with that name already exists';
    },
  },
]);

const issueProject = await Gms2Project.cloneProject({
  templatePath: (answers.newTemplate || answers.template).toString(),
  name: answers.name,
  where: GameMakerIssue.issuesDirectory.absolute,
});

await issueProject.issue.updateForm({
  affected: answers.affected,
  platforms: answers.platforms,
  summary: answers.summary,
  description: answers.description,
  type: answers.type,
});

await openGameMakerIssue(issueProject);
