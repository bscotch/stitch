import vscode from 'vscode';

/**
 * Assert a claim and, if it fails, both throw an error
 * and show the error in vscode.
 */
export function assertLoudly(
  condition: any,
  message: string,
): asserts condition {
  if (!condition) {
    vscode.window.showErrorMessage(message);
    throw new Error(message);
  }
}
