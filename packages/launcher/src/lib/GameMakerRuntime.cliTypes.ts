export type GameMakerCliPackageCommand = `Package${string}`;
export type GameMakerCliWorker =
  | 'windows'
  | 'mac'
  | 'linux'
  | 'html5'
  | 'ios'
  | 'tvos'
  | 'android'
  | 'amazonfire'
  | 'winuwp'
  | 'ps4'
  | 'ps5'
  | 'xboxone'
  | 'xboxseriesxs'
  | 'wasm'
  | 'operagx'
  | 'switch'
  | 'tests'
  | 'runtime';

export type GameMakerCliBuildCommand =
  | 'Run'
  | 'Clean'
  | 'Stop'
  | 'PreRunStep'
  | 'PostRunStep'
  | 'PreBuildStep'
  | 'PostBuildStep'
  | 'PrePackageStep'
  | 'PostPackageStep';

export type GameMakerCliCommand<W extends GameMakerCliWorker> = {
  windows: 'PackageZip' | 'PackageNsis' | 'Package' | GameMakerCliBuildCommand;
  mac: 'PackageDMG' | 'PackageZip' | 'Package' | GameMakerCliBuildCommand;
  linux: 'IniFile' | 'Package' | GameMakerCliBuildCommand;
  html5: 'zip' | 'folder' | 'Package' | GameMakerCliBuildCommand;
  ios:
    | 'HandleExtensions'
    | 'Package'
    | 'LaunchXcWorkspaceYYC'
    | 'DetectDevices'
    | 'DetectSimulators'
    | 'LaunchSimulator'
    | GameMakerCliBuildCommand;
  tvos:
    | 'IniFile'
    | 'HandleExtensions'
    | 'Package'
    | 'LaunchXcWorkspaceYYC'
    | 'DetectDevices'
    | 'DetectSimulators'
    | 'LaunchSimulator'
    | GameMakerCliBuildCommand;
  android: 'Package' | GameMakerCliBuildCommand;
  amazonfire: 'Package' | GameMakerCliBuildCommand;
  winuwp:
    | 'PackageArm'
    | 'PackageArmStore'
    | 'PackageX86'
    | 'PackageX86Store'
    | 'PackageX64'
    | 'PackageX64Store'
    | 'Package'
    | GameMakerCliBuildCommand;
  ps4: 'IniFile' | 'WriteMemoryFile' | 'Package' | GameMakerCliBuildCommand;
  ps5: 'IniFile' | 'Package' | GameMakerCliBuildCommand;
  xboxone:
    | 'IniFile'
    | 'PackageDev'
    | 'PackageSubmission'
    | 'Package'
    | GameMakerCliBuildCommand;
  xboxseriesxs:
    | 'IniFile'
    | 'PackageDevXboxOne'
    | 'PackageDevXboxSeriesXS'
    | 'PackageSubmissionXboxOne'
    | 'PackageSubmissionXboxSeriesXS'
    | 'Package'
    | GameMakerCliBuildCommand;
  wasm: 'IniFile' | 'Package' | GameMakerCliBuildCommand;
  operagx: 'IniFile' | 'Package' | GameMakerCliBuildCommand;
  switch: 'IniFile' | 'Package' | GameMakerCliBuildCommand;
  tests: 'CalculateCoverage' | 'RunTests';
  runtime:
    | 'ListInstalled'
    | 'Info'
    | 'Install'
    | 'List'
    | 'Verify'
    | 'FetchLicense';
}[W];

export type GameMakerCliBuildWorker =
  | 'windows'
  | 'mac'
  | 'linux'
  | 'html5'
  | 'ios'
  | 'tvos'
  | 'android'
  | 'amazonfire'
  | 'winuwp'
  | 'ps4'
  | 'ps5'
  | 'xboxone'
  | 'xboxseriesxs'
  | 'wasm'
  | 'operagx'
  | 'switch';

export interface GameMakerCliOptions {
  /**
   * password to use for testing SSH connections
   */
  password: string;
  /**
   * username to use for testing SSH connections
   */
  username: string;
  /**
   * hostname to use for testing SSH connections
   */
  hostname: string;
  /**
   * path to a file containing variables (deprecated)
   */
  options: string;
  /**
   * show less output from commands
   */
  quiet: boolean;
  /**
   * yyp project file
   */
  project: string;
  /**
   * path to the runtime to use
   */
  runtimePath: string;
  /**
   * url to the rss feed containing runtimes
   */
  runtimeUrl: string;
  /**
   * VM or YYC
   */
  runtime: string;
  /**
   * folder to use as a build cache
   */
  cache: string;
  /**
   * project config to build
   */
  config: string;
  /**
   * folder to store temporary files created during
   */
  temp: string;
  /**
   * path to the user folder for the user doing the
   */
  user: string;
  /**
   * output filename
   */
  of: string;
  /**
   * target filename
   */
  tf: string;
  /**
   * overall timeout for test including build
   */
  timeout: string;
  /**
   * time for test to wait once inside main loop
   */
  waittime: string;
  /**
   * the name of the device to run on
   */
  device: string;
  /**
   * the path to a licence file, if not specified
   */
  licencefile: string;
  /**
   * the path to a devices.json file, if not
   */
  devicefile: string;
  /**
   * comma separated list of targets for tests, e.g.
   */
  target: string;
  /**
   * the name of the remote worker to do the build on
   */
  worker: string;
  /**
   * does a debug build
   */
  debug: boolean;
  /**
   * sets the port the debugger will try to connect on
   */
  dbgp: string;
  /**
   * path to a file containing remote target options
   */
  targetOptions: string;
  /**
   * Destination folder to copy a framework to on
   */
  destFolder: string;
  /**
   * output file for JSON with timing stats
   */
  timingStats: string;
  /**
   * output file for function stats
   */
  functionStats: string;
  /**
   * input file for fnames (needed for coverage info)
   */
  fnames: string;
  /**
   * parent project to be used while testing
   */
  parentproject: string;
  /**
   * increase the amount of verbose output
   */
  verbose: boolean;
  /**
   * tell asset compiler to ignore cache
   */
  ignorecache: boolean;
  /**
   * pass option to the asset compiler
   */
  assetCompiler: string;
  /**
   * Device identifier for target device
   */
  targetDevice: string;
  /**
   * Steam SDK Directory
   */
  ssdk: string;
  /**
   * force Igor to think console is redirected
   */
  consoleRedirect: boolean;
  /**
   * runtime modules to download
   */
  modules: string;
  /**
   * api access key
   */
  accessKey: string;
}
