import { Pathy } from '@bscotch/pathy';
import { formatTimestamp } from '@bscotch/utility';
import { spawn } from 'child_process';
import {
  GameMakerCliCommand,
  GameMakerCliWorker,
} from '../types/gameMakerCli.js';
import type { GameMakerEngine } from './GameMakerEngine.js';
import { GameMakerEngineStatic } from './GameMakerEngine.static.js';
import {
  GameMakerBuildOptions,
  GameMakerEngineProject,
  GameMakerExecuteOptions,
  GameMakerExecutionResults,
  GameMakerLogOptions,
} from './GameMakerEngine.types.js';

export async function runGameMakerCommand<W extends GameMakerCliWorker>(
  engine: GameMakerEngine,
  project: GameMakerEngineProject,
  worker: W,
  command: GameMakerCliCommand<W>,
  executionOptions: GameMakerExecuteOptions,
  otherOptions?: GameMakerLogOptions,
) {
  const childEnv = { ...process.env };
  if (childEnv.PATH && engine.currentOs == 'windows') {
    //This is because node's the ENV contain the PATH variable that conflicts with MSBuild
    //See https://github.com/dotnet/msbuild/issues/5726
    delete childEnv.PATH;
  }
  let args = Object.entries(executionOptions)
    .map((option) => {
      const [key, value] = option;
      if (typeof value === 'undefined') {
        return;
      }
      let arg = `--${key}`;
      if (typeof value !== 'boolean') {
        arg += `=${value}`;
      }
      return arg;
    })
    .filter((x) => x) as string[];
  const cmd = (await engine.cliPath()).absolute;
  args = [...args, `--project=${project.yypPathAbsolute}`, worker, command];
  console.log('🚀 Running GameMaker CLI command:');
  console.log(cmd, ...args);
  const child = spawn(cmd, args, {
    env: childEnv,
    stdio: 'pipe',
  });

  // Set up writeable file streams
  const timestamp = formatTimestamp(new Date(), {
    secondsPrecision: 0,
    timeSeparator: '',
  });

  const logDir = await GameMakerEngineStatic.logDir(project, otherOptions);
  const logFilePathy = (fileName: string) => {
    const logFileName = `${
      otherOptions?.excludeLogFileTimestamps ? '' : `${timestamp}.`
    }${fileName}.txt`;
    const logFilePath = new Pathy(logDir.join(logFileName));
    return logFilePath;
  };

  const results: Partial<GameMakerExecutionResults> = {};
  for (const pipe of ['stdout', 'stderr'] as const) {
    // Create a writeable filestream
    child[pipe].on('data', (data) => {
      const dataString = data.toString();
      results[pipe] += dataString;
      console[pipe === 'stderr' ? 'error' : 'log'](dataString);
    });
  }

  return new Promise((resolve: (s: GameMakerExecutionResults) => void) => {
    child.on('exit', async () => {
      // The text "Igor complete." appears
      // after the compile logs (if compile
      // was successful) AND after the run
      // (if the run exited normally).
      const successMessage = 'Igor complete.';
      const logParts = results.stdout!.split(successMessage);
      results.compileSucceeded = logParts.length > 1;

      const wasRunnable = command === 'Run' && results.compileSucceeded;
      const containedTwoIgorCompletes = logParts.length === 3;
      results.runnerSucceeded = wasRunnable
        ? containedTwoIgorCompletes
        : undefined;

      // Add compiler & runner logs
      for (const [index, source] of (
        ['compiler', 'runner'] as const
      ).entries()) {
        let content = logParts[index];
        if (!content) {
          continue;
        }
        const needsSuccessMessage =
          (index === 0 && results.compileSucceeded) ||
          (index === 1 && results.runnerSucceeded);
        if (needsSuccessMessage) {
          content += successMessage;
        }
        const logName = `${source}Logs` as const;
        results[logName] = content;
        const logFileKey = `${source}LogsPath` as const;
        const logFilePath = logFilePathy(source);
        await logFilePath.write(content);
        results[logFileKey] = logFilePath.absolute;
      }

      resolve(results as GameMakerExecutionResults);
    });
  });
}

export async function runBuildCommand(
  this: GameMakerEngine,
  project: GameMakerEngineProject,
  options?: GameMakerBuildOptions & { compile?: boolean },
) {
  const target = options?.targetPlatform || 'windows';
  const command = options?.compile
    ? target === 'windows'
      ? 'PackageZip'
      : 'Package'
    : 'Run';
  const outputDir = new Pathy(options?.outDir || project.yypDirAbsolute);
  const tempDir = new Pathy(project.yypDirAbsolute).join('tmp');
  const results = await this.execute(
    project,
    target,
    command,
    {
      user: (await this.userDirectory()).absolute,
      runtimePath: (await this.runtimeDirectory()).absolute,
      runtime: options?.yyc ? 'YYC' : 'VM',
      config: options?.config,
      verbose: true,
      ignorecache: true,
      cache: tempDir.join('igor/cache').absolute,
      temp: tempDir.join('igor/temp').absolute,
      // For some reason the filename has to be there
      // but only the directory is used...
      of: tempDir.join(`igor/out/${project.name}.win`).absolute,
      tf: outputDir.join(
        `${project.name}.${GameMakerEngineStatic.artifactExtension(target)}`,
      ).absolute,
    },
    options,
  );
  return results;
}
