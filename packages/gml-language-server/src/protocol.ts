/**
 * The Stitch-specific parts of the language server's protocol: its
 * initialization options, settings, and custom `stitch/*` messages.
 *
 * This module has no dependencies, so clients can import it without pulling
 * in the server.
 */

export type DiagnosticLevel = 'error' | 'warning' | 'info' | 'hint' | 'off';

export type FormatPreset = 'standard' | 'bscotch';

/** Settings that change how the server behaves. All are optional. */
export interface GmlServerSettings {
  diagnostics?: {
    /**
     * Asset-tree folders (e.g. `Libraries/Vendor`) whose files get no
     * diagnostics.
     */
    suppressGroups?: string[];
    /** Undeclared variables with these prefixes are assumed to exist */
    autoDeclaredGlobalsPrefixes?: string[];
    /** Global functions, constructors, etc. without doc comments. @default 'off' */
    missingDocs?: DiagnosticLevel;
    /** Mixed operators without parentheses. @default 'off' */
    mixedOperators?: DiagnosticLevel;
    /** Calls where more than one argument has side effects. @default 'off' */
    argumentEvaluationOrder?: DiagnosticLevel;
    /** Arguments whose types clearly don't match. @default 'warning' */
    argumentTypes?: DiagnosticLevel;
  };
  format?: {
    /** @default 'bscotch' */
    preset?: FormatPreset;
  };
  completion?: {
    /**
     * Symbols with this prefix are left out of completions, unless they're
     * declared in the same file.
     */
    ignoredPrefix?: string | null;
  };
  workspaceSymbols?: {
    /** Include object, constructor and mixin variables. @default true */
    includeInstanceVariables?: boolean;
    /** Include the local variables of the active file. @default true */
    includeLocalVariables?: boolean;
    /** @default 30 */
    maxResults?: number;
  };
  /**
   * How long to wait (ms) after an edit before re-analyzing. Requests that
   * need up-to-date results don't wait. @default 50
   */
  analysisDelay?: number;
}

/** The `initializationOptions` the server expects */
export interface GmlServerInitializationOptions {
  /** Absolute path to the project's `.yyp` file */
  yypPath: string;
  /**
   * `GmlSpec.xml` files to load built-in functions, variables and constants
   * from. Defaults to the spec bundled with the server.
   */
  specs?: string[];
  settings?: GmlServerSettings;
}

//#region Custom messages

/** Server → client notification: what the server is doing */
export const statusNotification = 'stitch/status';
export interface StatusParams {
  state: 'loading' | 'ready' | 'error';
  message?: string;
  /** When ready: how many GML files were analyzed, and how long it took */
  files?: number;
  ms?: number;
}

/**
 * Client → server request: describe the symbol at a position, e.g. to decide
 * which commands apply to it.
 */
export const symbolInfoRequest = 'stitch/symbolInfo';
export interface SymbolInfoParams {
  textDocument: { uri: string };
  position: { line: number; character: number };
}
export interface SymbolInfo {
  name: string;
  /** e.g. `function`, `variable`, `asset`, `enum` */
  kind: string;
  native: boolean;
  /** For assets, their kind (`sprites`, `sounds`, ...) */
  assetKind?: string;
  /** The symbol's type, in Feather notation (e.g. `Real|String`) */
  type: string;
  /** For constructors, the type of the struct they create (e.g. `Struct.Foo`) */
  constructs?: string;
  deprecated?: boolean;
}

/**
 * Client → server request: the code edits that rename every reference to an
 * asset. Ask *before* renaming the asset's files, and apply the edits before
 * or after the rename (they only touch code that refers to the asset).
 *
 * Returns an LSP `WorkspaceEdit`.
 */
export const assetRenameEditsRequest = 'stitch/assetRenameEdits';
export interface AssetRenameEditsParams {
  name: string;
  newName: string;
}

/**
 * Client → server request: the names of the global symbols the project
 * defines (functions, constructors, macros, enums, global variables and
 * assets; not built-ins). Returns `string[]`.
 */
export const globalNamesRequest = 'stitch/globalNames';

//#endregion

/** The semantic token types the server uses, in legend order */
export const semanticTokenTypes = [
  'function',
  'variable',
  'enum',
  'macro',
  'class',
  'enumMember',
  'parameter',
  'property',
] as const;

/** The semantic token modifiers the server uses, in legend order */
export const semanticTokenModifiers = [
  'readonly',
  'defaultLibrary',
  'declaration',
  'static',
  'deprecated',
  'local',
  'asset',
  'global',
] as const;
