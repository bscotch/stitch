import { undent } from '@bscotch/utility';
import { ok } from 'assert';
import fsp from 'fs/promises';

const commands = `
windows        Run
windows        PackageZip
windows        PackageNsis
windows        Clean
windows        Stop
windows        Package
windows        PreRunStep
windows        PostRunStep
windows        PreBuildStep
windows        PostBuildStep
windows        PrePackageStep
windows        PostPackageStep

mac            Clean
mac            Run
mac            PackageDMG
mac            PackageZip
mac            Stop
mac            Package
mac            PreRunStep
mac            PostRunStep
mac            PreBuildStep
mac            PostBuildStep
mac            PrePackageStep
mac            PostPackageStep

linux          IniFile
linux          Run
linux          Package
linux          Clean
linux          Stop
linux          PreRunStep
linux          PostRunStep
linux          PreBuildStep
linux          PostBuildStep
linux          PrePackageStep
linux          PostPackageStep

html5          Run
html5          zip
html5          folder
html5          Package
html5          Clean
html5          Stop
html5          PreRunStep
html5          PostRunStep
html5          PreBuildStep
html5          PostBuildStep
html5          PrePackageStep
html5          PostPackageStep

ios            Clean
ios            HandleExtensions
ios            Run
ios            Package
ios            LaunchXcWorkspaceYYC
ios            DetectDevices
ios            DetectSimulators
ios            LaunchSimulator
ios            Stop
ios            PreRunStep
ios            PostRunStep
ios            PreBuildStep
ios            PostBuildStep
ios            PrePackageStep
ios            PostPackageStep

tvos           IniFile
tvos           Clean
tvos           HandleExtensions
tvos           Run
tvos           Package
tvos           LaunchXcWorkspaceYYC
tvos           DetectDevices
tvos           DetectSimulators
tvos           LaunchSimulator
tvos           Stop
tvos           PreRunStep
tvos           PostRunStep
tvos           PreBuildStep
tvos           PostBuildStep
tvos           PrePackageStep
tvos           PostPackageStep

android        Run
android        Package
android        Stop
android        Clean
android        PreRunStep
android        PostRunStep
android        PreBuildStep
android        PostBuildStep
android        PrePackageStep
android        PostPackageStep

amazonfire     Run
amazonfire     Package
amazonfire     Stop
amazonfire     Clean
amazonfire     PreRunStep
amazonfire     PostRunStep
amazonfire     PreBuildStep
amazonfire     PostBuildStep
amazonfire     PrePackageStep
amazonfire     PostPackageStep

winuwp         Run
winuwp         PackageArm
winuwp         PackageArmStore
winuwp         PackageX86
winuwp         PackageX86Store
winuwp         PackageX64
winuwp         PackageX64Store
winuwp         Package
winuwp         Clean
winuwp         Stop
winuwp         PreRunStep
winuwp         PostRunStep
winuwp         PreBuildStep
winuwp         PostBuildStep
winuwp         PrePackageStep
winuwp         PostPackageStep

ps4            IniFile
ps4            WriteMemoryFile
ps4            Run
ps4            Package
ps4            Clean
ps4            Stop
ps4            PreRunStep
ps4            PostRunStep
ps4            PreBuildStep
ps4            PostBuildStep
ps4            PrePackageStep
ps4            PostPackageStep

ps5            IniFile
ps5            Run
ps5            Package
ps5            Clean
ps5            Stop
ps5            PreRunStep
ps5            PostRunStep
ps5            PreBuildStep
ps5            PostBuildStep
ps5            PrePackageStep
ps5            PostPackageStep

xboxone        IniFile
xboxone        Run
xboxone        PackageDev
xboxone        PackageSubmission
xboxone        Clean
xboxone        Stop
xboxone        Package
xboxone        PreRunStep
xboxone        PostRunStep
xboxone        PreBuildStep
xboxone        PostBuildStep
xboxone        PrePackageStep
xboxone        PostPackageStep

xboxseriesxs   IniFile
xboxseriesxs   Run
xboxseriesxs   PackageDevXboxOne
xboxseriesxs   PackageDevXboxSeriesXS
xboxseriesxs   PackageSubmissionXboxOne
xboxseriesxs   PackageSubmissionXboxSeriesXS
xboxseriesxs   Clean
xboxseriesxs   Stop
xboxseriesxs   Package
xboxseriesxs   PreRunStep
xboxseriesxs   PostRunStep
xboxseriesxs   PreBuildStep
xboxseriesxs   PostBuildStep
xboxseriesxs   PrePackageStep
xboxseriesxs   PostPackageStep

wasm           IniFile
wasm           Run
wasm           Package
wasm           Clean
wasm           Stop
wasm           PreRunStep
wasm           PostRunStep
wasm           PreBuildStep
wasm           PostBuildStep
wasm           PrePackageStep
wasm           PostPackageStep

operagx        IniFile
operagx        Run
operagx        Package
operagx        Clean
operagx        Stop
operagx        PreRunStep
operagx        PostRunStep
operagx        PreBuildStep
operagx        PostBuildStep
operagx        PrePackageStep
operagx        PostPackageStep

switch         IniFile
switch         Run
switch         Package
switch         Clean
switch         Stop
switch         PreRunStep
switch         PostRunStep
switch         PreBuildStep
switch         PostBuildStep
switch         PrePackageStep
switch         PostPackageStep

tests          CalculateCoverage
tests          RunTests

runtime        ListInstalled
runtime        Info
runtime        Install
runtime        List
runtime        Verify
runtime        FetchLicense
`;

const options = `
      --password=VALUE       password to use for testing SSH connections
      --username=VALUE       username to use for testing SSH connections
      --hostname=VALUE       hostname to use for testing SSH connections
      --options=VALUE        path to a file containing variables (deprecated)
  -q, --quiet                show less output from commands
      --project=VALUE        yyp project file
      --rp, --runtimePath=VALUE
                             path to the runtime to use
      --ru, --runtimeUrl=VALUE
                             url to the rss feed containing runtimes
  -r, --runtime=VALUE        VM or YYC
      --cache=VALUE          folder to use as a build cache
      --config=VALUE         project config to build
      --temp=VALUE           folder to store temporary files created during
                               build
      --uf, --user=VALUE     path to the user folder for the user doing the
                               build
  -j=VALUE                   number of cores AssetCompiler should use
      --of=VALUE             output filename
      --tf=VALUE             target filename
  -t, --timeout=VALUE        overall timeout for test including build
      --wt, --waittime=VALUE time for test to wait once inside main loop
  -d, --device=VALUE         the name of the device to run on
      --lf, --licencefile=VALUE
                             the path to a licence file, if not specified
                               we'll look in the user folder
      --df, --devicefile=VALUE
                             the path to a devices.json file, if not
                               specified we'll look in the user folder
      --target=VALUE         comma separated list of targets for tests, e.g.
                               Windows|Local,HTML5|selenium:firefox
  -w, --worker=VALUE         the name of the remote worker to do the build on
      --debug                does a debug build
      --dbgp=VALUE           sets the port the debugger will try to connect on
      --targetOptions=VALUE  path to a file containing remote target options
                               (deprecated)
      --destFolder=VALUE     Destination folder to copy a framework to on
                               macOS remote
      --timingStats=VALUE    output file for JSON with timing stats
      --functionStats=VALUE  output file for function stats
      --fnames=VALUE         input file for fnames (needed for coverage info)
      --parentproject=VALUE  parent project to be used while testing
  -v, --verbose              increase the amount of verbose output
      --ic, --ignorecache    tell asset compiler to ignore cache
      --ac, --assetCompiler=VALUE
                             pass option to the asset compiler
      --targetDevice=VALUE   Device identifier for target device
      --ssdk=VALUE           Steam SDK Directory
      --cr, --consoleRedirect
                             force Igor to think console is redirected
  -m, --modules=VALUE        runtime modules to download
      --ak, --accessKey=VALUE
                             api access key
`;

/**
 * @type {{[worker:string]: string[]}}
 */
const workerCommands = {};

for (const line of commands.split(/[\r\n]+/)) {
  const parts = line.match(/^([^\s]+)\s+([^\s]+)/);
  if (!parts) {
    continue;
  }
  const [, worker, command] = parts;
  workerCommands[worker] ||= [];
  workerCommands[worker].push(command);
}

const commonBuildCommands = [
  'Run',
  'Clean',
  'Stop',
  'PreRunStep',
  'PostRunStep',
  'PreBuildStep',
  'PostBuildStep',
  'PrePackageStep',
  'PostPackageStep',
];

// Write the worker commands to a file as Typescript types
let types = `
export type GameMakerCliPackageCommand = \`Package\${string}\`;
export type GameMakerCliWorker = ${stringUnion(Object.keys(workerCommands))};

export type GameMakerCliBuildCommand = ${stringUnion(commonBuildCommands)};

export type GameMakerCliCommand<W extends GameMakerCliWorker> = {`;
const buildTargets = [];
for (const [worker, commands] of Object.entries(workerCommands)) {
  types += `${worker}: `;
  const isBuildTarget = commonBuildCommands.every((command) =>
    commands.includes(command),
  );
  if (isBuildTarget) {
    buildTargets.push(worker);
    // Then remove the common commands
    const additionalCommands = commands.filter(
      (command) => !commonBuildCommands.includes(command),
    );
    types += `${stringUnion(
      additionalCommands,
    )} | GameMakerCliBuildCommand ;\n`;
  } else {
    types += `${stringUnion(commands)};\n`;
  }
}
types += `\n}[W];\n\nexport type GameMakerCliBuildWorker = ${stringUnion(
  buildTargets,
)};\n\n`;

// Parse the options
types += 'export interface GameMakerCliOptions {\n';
const optionsLines = options.split(/[\r\n]+/);
for (let l = 0; l <= optionsLines.length; l++) {
  const line = optionsLines[l];
  if (!line) {
    continue;
  }
  const optionNameInfo = parseOptionName(line);
  if (!optionNameInfo) {
    continue;
  }
  const descriptionInfo = parseOptionDescription(line, optionsLines[l + 1]);
  ok(
    descriptionInfo,
    `Could not parse description for option ${optionNameInfo}`,
  );

  types += undent`
    /**
     * ${descriptionInfo.description}
     */`;
  types += `\n  ${optionNameInfo.name}: ${
    optionNameInfo.isFlag ? 'boolean' : 'string'
  };\n`;

  l += descriptionInfo.skip;
}
types += '}\n';

await fsp.writeFile('src/lib/GameMakerRuntime.cliTypes.ts', types);

/**
 * Get the option flags from a line
 *
 * @param {string} line
 */
function parseOptionName(line) {
  const options = line.matchAll(/\s+(--(?<optionName>[a-zA-Z]+))/g);
  const matches = [...options];
  if (!matches.length) {
    return;
  }
  return {
    // @ts-ignore
    name: matches.at(-1)?.groups.optionName,
    isFlag: !line.includes('=VALUE'),
  };
}

/**
 *
 * @param {string} firstLine
 * @param {string|undefined} secondLine
 */
function parseOptionDescription(firstLine, secondLine) {
  const [firstLineMatch, secondLineMatch] = [firstLine, secondLine || ''].map(
    (line) => line.match(/\s+([^-\s].+)/),
  );
  if (firstLineMatch) {
    return {
      description: firstLineMatch[1],
      skip: 0,
    };
  } else if (secondLineMatch) {
    return {
      description: secondLineMatch[1],
      skip: 1,
    };
  }
}

/**
 * @param {string[]} strings
 */
function stringUnion(strings) {
  return `'${strings.join(`' | '`)}'`;
}
