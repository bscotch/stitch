import type { DiagnosticsEventPayload } from '@bscotch/gml-parser';
import { assert } from './assert.mjs';
import { rangeFrom } from './lib.mjs';

import vscode from 'vscode';

export const diagnosticCollection =
  vscode.languages.createDiagnosticCollection('gml');

export function normalizeDiagnosticsEvents(payload: DiagnosticsEventPayload) {
  assert(payload, 'diagnostics must be an array');
  return payload.diagnostics.map((d) => ({
    message: d.message,
    range: rangeFrom(d.location),
    severity:
      d.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : d.severity === 'info'
        ? vscode.DiagnosticSeverity.Information
        : vscode.DiagnosticSeverity.Warning,
    source: 'stitch',
  }));
}
