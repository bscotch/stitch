export type * from './analysis.types.ts';
export {
  GmlAnalyzer,
  type AnalyzeResult,
  type AnalyzerOptions,
  type AssetInfo,
  type ExtensionInfo,
  type ProjectInfo,
} from './analyzer.ts';
export { fileDiagnostics, type DiagnosticOptions } from './diagnostics.ts';
export {
  declare,
  parseFile,
  type FileDeclarations,
  type ParsedFile,
  type SourceFile,
  type SourceFileKind,
} from './file.ts';
export { NativeTable, parseTypeString } from './natives.ts';
export {
  analyzeProject,
  listSourceFiles,
  projectInfo,
  type AnalyzeProjectOptions,
} from './project.ts';
export {
  GmlQueries,
  type HoverInfo,
  type SemanticToken,
  type SemanticTokenModifier,
  type SemanticTokenType,
  type TextEdit,
  type WorkspaceSymbol,
} from './queries.ts';
export * from './spec.ts';
export * from './symbols.ts';
export { ProjectTable, type ChangeSet, type FileProvides } from './table.ts';
export * from './types.ts';
