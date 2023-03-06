import { Pathy } from '@bscotch/pathy';
import { merge, undent } from '@bscotch/utility';
import os from 'os';
import { stringify as stringifyQueryParams } from 'querystring';
import { stringify as yamlStringify } from 'yaml';
import { issueTypes } from './GameMakerIssue.constants.js';
import { GameMakerIssueStatic } from './GameMakerIssue.static.js';
import {
  GameMakerIssueEnvironment,
  GameMakerIssueForm,
  GameMakerIssueUpdateOptions,
} from './GameMakerIssue.types.js';
import type { StitchProject } from './StitchProject.js';

export class GameMakerIssue extends GameMakerIssueStatic {
  constructor(readonly project: StitchProject) {
    super();
  }

  get directory() {
    return new Pathy(this.project.yypDirAbsolute).join('issue');
  }

  get attachmentsDirectory() {
    return this.directory.join('attachments');
  }

  get formPath(): Pathy<GameMakerIssueForm> {
    return this.directory.join('issue.yaml');
  }

  get uiLogPath() {
    return this.attachmentsDirectory.join('ui.log');
  }

  get envInfoPath() {
    return this.directory.join('environment.yaml');
  }

  async readForm<AllowInvalid = undefined>(
    allowInvalid?: AllowInvalid,
  ): Promise<AllowInvalid extends true ? any : GameMakerIssueForm> {
    const template = (await this.formPath.exists())
      ? await this.formPath.read<GameMakerIssueForm>()
      : {
          type: undefined,
          summary: undefined,
          description: undefined,
          platforms: [],
          affected: [],
        };
    if (!allowInvalid) {
      GameMakerIssue.validateForm(template as any);
    }
    return template as any;
  }

  async updateForm(form: Partial<GameMakerIssueForm>) {
    await GameMakerIssue.ensureFormSchemaExists();
    const startingValues = await this.readForm(true);
    const updatedValues = merge(startingValues, form);
    const formAsString = yamlStringify(updatedValues, {
      keepUndefined: true,
    });
    await this.formPath.write(
      `# yaml-language-server: $schema=../../${GameMakerIssueStatic.formSchemaBasename}\n\n${formAsString}`,
      { serialize: false },
    );
  }

  async compileReport(options?: { cc?: string; from?: string }) {
    // Load the template
    const template = await this.readForm();
    const env = await this.environment();
    const body = undent`
      Bug Type: ${issueTypes[template.type]}
      Ide Version: ${env.ideVersion}
      Runtime Version: ${env.runtimeVersion}
      Os: ${env.os}
      Platforms: ${template.platforms.join(', ')}
      Components: ${template.affected.join(', ')}

      Description:
      
      ${template.description}
    `;

    // Construct a mailto URL
    const to = 'support@yoyogames.zendesk.com';
    const params = {
      subject: template.summary,
      body,
      cc: options?.cc,
      from: options?.from,
    };
    const mailTo = `mailto:${to}?${stringifyQueryParams(params)}`;
    return {
      plainText: body,
      mailTo,
    };
  }

  async environment(): Promise<GameMakerIssueEnvironment> {
    return await this.envInfoPath.read();
  }

  async collectLogs(options?: GameMakerIssueUpdateOptions) {
    if (!options?.skipTemplateValidation) {
      await this.readForm();
    }

    // Run the project & collect its output
    const runResults = await this.project.run({
      config: options?.compilerConfig,
      excludeLogFileTimestamps: true,
      logDir: this.attachmentsDirectory.absolute,
      // name: paramCase(issueName),
      // outDir: issueDir.absolute,
      yyc: options?.useYyc,
    });
    // Copy the latest ui.log
    const engine = this.project.engine();
    await engine.uiLogPath.copy(this.uiLogPath);

    // Get the runtime version
    // Get the IDE version
    const env: GameMakerIssueEnvironment = {
      runtimeVersion: await engine.runtimeVersion(),
      ideVersion: this.project.ideVersion,
      os: `${os.version()}: ${os.release()}`,
    };

    await this.envInfoPath.write(env);

    // Create a snapshot of the project state
    await this.project.exportYyz({
      outputDirectory: this.attachmentsDirectory.absolute,
    });

    return runResults;
  }

  static async listIssues() {
    return await GameMakerIssue.issuesDirectory.listChildrenRecursively({
      includePatterns: [/\.yyp$/],
    });
  }
}
