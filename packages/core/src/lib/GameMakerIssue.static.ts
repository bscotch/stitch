import { Pathy } from '@bscotch/pathy';
import { default as Ajv } from 'ajv';
import { homedir } from 'os';
import { gameMakerIssueSchema } from './GameMakerIssue.constants.js';
import type { GameMakerIssueForm } from './GameMakerIssue.types.js';

export class GameMakerIssueStatic {
  static get formSchemaBasename() {
    return 'issue.schema.json';
  }

  static get issuesDirectory() {
    const issuesDir = `${homedir()}/.stitch/issues`;
    return new Pathy(issuesDir, issuesDir);
  }

  private static readonly validator = new Ajv({ coerceTypes: 'array' }).compile(
    gameMakerIssueSchema,
  );

  static validateForm(template: GameMakerIssueForm) {
    const valid = GameMakerIssueStatic.validator(template);
    if (!valid) {
      console.error(GameMakerIssueStatic.validator.errors);
      throw new Error('Invalid issue');
    }
  }

  static get formSchemaPath(): Pathy<typeof gameMakerIssueSchema> {
    return GameMakerIssueStatic.issuesDirectory.join(
      GameMakerIssueStatic.formSchemaBasename,
    );
  }

  /**
   * Ensure that the Issues directory exists,
   * and that it contains the up to date schema file.
   */
  static async ensureFormSchemaExists() {
    await GameMakerIssueStatic.issuesDirectory.ensureDirectory();
    // Write the schema to the issues folder
    await GameMakerIssueStatic.formSchemaPath.write(gameMakerIssueSchema);
  }
}
