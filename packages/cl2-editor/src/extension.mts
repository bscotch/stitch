import vscode from 'vscode';

export class Cl2Workspace {
  protected constructor(readonly ctx: vscode.ExtensionContext) {}

  static activate(ctx: vscode.ExtensionContext) {
    const provider = new Cl2Workspace(ctx);
    return provider;
  }
}
