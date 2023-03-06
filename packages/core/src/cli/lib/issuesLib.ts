import { Pathy } from '@bscotch/pathy';
import open from 'open';
import { StitchProject } from '../../index.js';
import { GameMakerIssue } from '../../lib/GameMakerIssue.js';

function yypFileArrayToChoices(yypArray: (string | Pathy)[]) {
  return yypArray.map((yyp) => ({
    name: Pathy.asInstance(yyp).up().name,
    value: yyp.toString(),
  }));
}

export async function listIssueProjectChoices() {
  const projects = await GameMakerIssue.listIssues();
  return yypFileArrayToChoices(projects);
}

export async function listLocalProjectChoices() {
  const projects = await StitchProject.listYypFilesRecursively(process.cwd());
  return yypFileArrayToChoices(projects);
}

export interface OpenablePath {
  path: string;
  app?: { name: string };
}

/**
 * Choices that can be used by inquirer, and passed
 * to `open()`, to open issue-related files and folders.
 */
export async function openGameMakerIssue(issueProject: StitchProject) {
  return await openPaths([
    issueProject.issue.formPath.relativeFrom(process.cwd()),
    {
      path: issueProject.issue.directory.toString({
        format: 'win32',
      }),
      app: { name: 'explorer' },
    },
    new Pathy(issueProject.yypPathAbsolute).relativeFrom(process.cwd()),
  ]);
}

export async function openPaths(paths: (string | OpenablePath)[]) {
  // Sometimes we get a weird error when
  // opening files, related to the existence
  // of this environment variable.
  process.env.NODE_OPTIONS = undefined;
  return await Promise.all(
    paths.map((path) =>
      typeof path === 'string'
        ? open(path)
        : open(path.path, path.app && { app: path.app }),
    ),
  );
}
