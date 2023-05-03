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
  get enableFunctionSignatureStatus() {
    return this.config.get<boolean>('editing.signatureStatus.enable');
  }
  get functionSignatureStatusAlignment(): vscode.StatusBarAlignment {
    const alignment = this.config.get<'left' | 'right'>(
      'editing.signatureStatus.alignment',
    );
    if (alignment === 'left') {
      return vscode.StatusBarAlignment.Left;
    }
    return vscode.StatusBarAlignment.Right;
  }
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
  get runCompilerDefault(): 'vm' | 'yyc' {
    return (
      this.config.get<string>('run.defaultCompiler') || 'vm'
    ).toLowerCase() as 'vm' | 'yyc';
  }
  get runConfigDefault(): string | null {
    return this.config.get<string>('run.defaultConfig') || null;
  }
}

export const config = new StitchConfig();
