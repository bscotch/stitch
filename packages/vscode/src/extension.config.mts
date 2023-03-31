import { pathy } from '@bscotch/pathy';
import vscode from 'vscode';

export interface StitchTaskDefinition extends vscode.TaskDefinition {
  type: 'stitch';
  projectName?: string;
  compiler?: 'vm' | 'yyc';
  config: string | null;
}

export class StitchConfig {
  protected readonly config = vscode.workspace.getConfiguration('stitch');
  get gmChannel() {
    return this.config.get<string | null>('gm.channel');
  }
  get gmlSpecPath() {
    return this.config.get<string | null>('gmlSpec.path');
  }
  get gmlSpecSource() {
    return this.config.get<string | null>('gmlSpec.source');
  }
  get templatePath() {
    return (
      this.config.get<string | null>('template.path') ||
      pathy(__dirname).join(
        '..',
        'assets',
        'templates',
        'issue-template',
        'issue-template.yyp',
      ).absolute
    );
  }
  get enableYyFormatting() {
    return this.config.get<boolean>('yy.format.enable');
  }
  get autoDetectTasks() {
    return this.config.get<boolean>('task.autoDetect') ?? true;
  }
  get runCompilerDefault(): 'vm' | 'yyc' {
    return (
      this.config.get<string>('task.run.defaultCompiler') || 'vm'
    ).toLowerCase() as 'vm' | 'yyc';
  }
  get runConfigDefault(): string | null {
    return this.config.get<string>('task.run.defaultConfig') || null;
  }
}
