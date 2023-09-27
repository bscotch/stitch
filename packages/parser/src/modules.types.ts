import { type YyResourceType } from '@bscotch/yy';

export interface ImportAction {
  action: 'create' | 'replace';
  /** Name of the asset */
  asset: string;
  /** The folder in the target where this asset would live */
  targetFolder: string;
}

interface RequirementBase {
  requiredBy: {
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
   * The folder in the source project to import from. Either
   * this or sourceAsset can be specified.
   */
  sourceFolder?: string;
  /**
   * The asset in the source project to import from. Either
   * this or sourceFolder can be specified.
   */
  sourceAsset?: string;

  /**
   * Folder to import into. Defaults to `sourceFolder`.
   */
  targetFolder?: string;
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
   * If set to 'skip', the import will proceed without the missing dependencies.
   *
   * If set to 'include', the missing deps will be included in the import and also
   * placed in the `targetProject`'s `targetFolder`.
   *
   * @default 'error'
   */
  onMissingDependency?: 'error' | 'skip' | 'include';
}
