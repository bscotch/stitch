const assetTreeFocused = 'view == bscotch-stitch-resources';
const hasProjects = 'stitch.projectCount > 0';
const hasOneProject = 'stitch.projectCount == 1';
const viewItemIsProject = 'viewItem == project';

export const when = {
  assetTreeFocused,
  hasProjects,
  hasOneProject,
  assetTreeFocusedAndHasOneProject: `${assetTreeFocused} && ${hasOneProject}`,
  assetTreeFocusedAndHasProjects: `${assetTreeFocused} && ${hasProjects}`,
  isInlineProject: `${assetTreeFocused} && ${hasProjects} && ${viewItemIsProject}`,
  anyGameMakerFileFocused: 'resourceExtname =~ /\\.(yy|gml|yyp)$',
  yypFocused: 'resourceExtname == ".yyp"',
  yyFocused: 'resourceExtname == ".yyp"',
  gmlFocused: 'resourceExtname == ".gml"',
  viewItemIsFilter: 'viewItem =~ /^tree-filter-(enabled|disabled)/',
  viewItemIsFilterGroup: 'viewItem == tree-filter-group',
  viewItemIsFilterEnabled: 'viewItem == tree-filter-enabled',
  viewItemIsFilterDisabled: 'viewItem == tree-filter-disabled',
  viewItemIsProject,
  viewItemIsFolder: 'viewItem == folder',
} as const;
