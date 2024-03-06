// See https://code.visualstudio.com/api/references/when-clause-contexts

const assetTreeFocused = 'view == bscotch-stitch-resources';
const spriteSourceTreeFocused = 'view == bscotch-stitch-sprite-sources';
const includedFileTreeFocused = 'view == bscotch-stitch-files';
const hasProjects = 'stitch.projectCount > 0';
const hasOneProject = 'stitch.projectCount == 1';
const viewItemIsProject = 'viewItem == project';
const resourceIsGml = 'resourceExtname == .gml';
const runnerViewFocused = 'view == bscotch-stitch-igor';

export const when = {
  onWindows: 'isWindows',
  assetTreeFocused,
  spriteSourceTreeFocused,
  includedFileTreeFocused,
  inspectorFocused: 'view == bscotch-stitch-inspector',
  editorFocused: 'editorFocus',
  hasProjects,
  runnerViewFocused,
  runningInTerminal: 'config.stitch.run.inTerminal',
  hasOneProject,
  assetTreeFocusedAndHasOneProject: `${assetTreeFocused} && ${hasOneProject}`,
  assetTreeFocusedAndHasProjects: `${assetTreeFocused} && ${hasProjects}`,
  isInlineProject: `${assetTreeFocused} && ${hasProjects} && ${viewItemIsProject}`,
  resourceIsGml,
  viewItemIsFilter: 'viewItem =~ /^tree-filter-(enabled|disabled)/',
  viewItemIsFilterGroup: 'viewItem == tree-filter-group',
  viewItemIsFilterEnabled: 'viewItem == tree-filter-enabled',
  viewItemIsFilterDisabled: 'viewItem == tree-filter-disabled',
  viewItemIsProject,
  viewItemIsFolder: 'viewItem == folder',
  viewItemIsAsset: 'viewItem =~ /^asset-/',
  viewItemIsObject: 'viewItem == asset-objects',
  viewItemIsSprite: 'viewItem == asset-sprites',
  viewItemIsSpriteFrame: 'viewItem == sprite-frame',
  viewItemIsCode: 'viewItem == code',
  viewItemIsIncludedFileFolder: 'viewItem == datafiles-folder',
  viewItemIsIncludedFile: 'viewItem == datafiles-file',
  viewItemIsInspectorEvents: 'viewItem == inspector-object-events',
  viewItemIsInspectorParents: 'viewItem == inspector-object-parents',
  viewItemIsInspectorSprite: 'viewItem == inspector-object-sprites',
  viewItemIsSpriteSource: 'viewItem =~ /^sprite-source(-(un)?watched)?$/',
  viewItemIsSpriteSourceStage: 'viewItem =~ /^sprite-source-stage-/',
  viewItemIsSpriteSourceWatched: 'viewItem == sprite-source-watched',
  viewItemIsSpriteSourceUnwatched: 'viewItem == sprite-source-unwatched',
  viewItemIsSpriteSourceRecentImports: `viewItem == sprites && ${spriteSourceTreeFocused}`,
} as const;
