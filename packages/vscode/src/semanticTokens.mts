import { literal } from '@bscotch/utility';
import vscode from 'vscode';

export type SemanticTokenType = (typeof semanticTokenTypes)[number];
export type SemanticTokenModifier = (typeof semanticTokenModifiers)[number];

const semanticTokenTypes = literal([
  'function',
  'variable',
  'enum',
  'macro',
  'class',
]);
const semanticTokenModifiers = literal([
  'global',
  'readonly',
  'asset',
  'defaultLibrary',
  'declaration',
]);

export const semanticTokensLegend = new vscode.SemanticTokensLegend(
  semanticTokenTypes,
  semanticTokenModifiers,
);
