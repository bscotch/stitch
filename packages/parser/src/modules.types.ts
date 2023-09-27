import { type YyResourceType } from '@bscotch/yy';

export interface ImportAction {
  type: 'create' | 'replace' | 'skip' | 'move';
  /** Name of the asset */
  asset: string;
  /** The folder in the target where this asset would live */
  targetFolder: string;
}

interface RequirementBase {
  requiredByAsset: {
    name: string;
    kind: YyResourceType;
  };
  requirement: {
    name: string;
    kind: YyResourceType;
  };
  relationship: 'parent' | 'child' | 'ref' | 'code';
}

export interface AssetDependency extends RequirementBase {
  relationship: 'parent' | 'child' | 'ref';
}

export interface CodeDependency extends RequirementBase {
  relationship: 'code';
  signifier: string;
  /** Where the signifier was defined */
  def: { file: string; line: number; column: number };
  /** Where the signifier was referenced */
  ref: { file: string; line: number; column: number };
}

export type Dependency = AssetDependency | CodeDependency;

export interface ImportModuleOptions {
  /**
   * Folder to import into. Defaults to `sourceFolder`.
   */
  targetFolder?: string;
  /**
   * If `true`, anything in `targetFolder` that doesn't have a match
   * in `sourceFolder` will be moved to an `IMPORT_CONFLICTS` folder.
   *
   * This is useful if you want to keep source and target folders in sync,
   * so that there is an exact 1:1 match in assets between the two.
   */
  sync?: boolean;
  /**
   * By default all resources are imported, but
   * you can specify a subset here.
   */
  types?: YyResourceType[];
  /**
   * A "missing dependency" is one that is neither in the target project
   * nor in the `sourceFolder` of the source project, but that is referenced
   * by an asset in `sourceFolder`. (For example, a sprite or parent object
   * referenced by an object).
   *
   * If set to 'error', the import will abort if there are any missing deps.
   *
   * If set to 'ignore', the import will proceed without the missing dependencies.
   *
   * If set to 'include', the missing deps will be included in the import and also
   * placed in the `targetProject`'s `targetFolder`.
   *
   * @default 'error'
   */
  onMissingDependency?: 'error' | 'ignore' | 'include';
}
