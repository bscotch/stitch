import { ok } from 'assert';
import dotenv from 'dotenv';
import { GameMakerProjectParser } from './project.js';

dotenv.config();

describe.only('Project Parser', function () {
  it('can has fallback GmlSpec', async function () {
    await GameMakerProjectParser.fallbackGmlSpecPath.exists({ assert: true });
  });

  it('can parse sample project', async function () {
    const projectDir = process.env.GML_PARSER_SAMPLE_PROJECT_DIR;
    ok(
      projectDir,
      'A dotenv file should provide a path to a full sample project, as env var GML_PARSER_SAMPLE_PROJECT_DIR',
    );
    const project = await GameMakerProjectParser.initialize(projectDir);
  });
});
