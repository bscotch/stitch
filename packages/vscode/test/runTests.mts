/**
 * Run the end-to-end tests: launch VS Code with the extension (an Extension
 * Development Host) on a copy of the sample project, and run the tests in
 * `test/e2e` inside it.
 *
 * Usage: `pnpm test` (builds the extension and the tests first).
 *
 * VS Code (stable) is downloaded into `.vscode-test/` the first time. To use
 * an installed copy instead, set `STITCH_TEST_VSCODE` to its executable.
 * Set `STITCH_TEST_KEEP=1` to keep the temporary workspace afterwards.
 */
import { runTests } from '@vscode/test-electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const extensionDir = path.resolve(import.meta.dirname, '..');
const sampleProject = path.resolve(extensionDir, '../parser/samples/project');

// A workspace whose project isn't at the root (#294), with a prefab next to
// it that must not be offered as a project (#291)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-e2e-'));
const workspace = path.join(tmp, 'workspace');
const projectDir = path.join(workspace, 'game');
fs.cpSync(sampleProject, projectDir, { recursive: true });
const prefabDir = path.join(projectDir, 'prefabs', 'io.example.prefab');
fs.mkdirSync(prefabDir, { recursive: true });
fs.copyFileSync(
  path.join(projectDir, 'project.yyp'),
  path.join(prefabDir, 'io.example.prefab.yyp'),
);

// A clean VS Code profile
const userDataDir = path.join(tmp, 'user-data');
fs.mkdirSync(path.join(userDataDir, 'User'), { recursive: true });
fs.writeFileSync(
  path.join(userDataDir, 'User', 'settings.json'),
  JSON.stringify({
    'workbench.startupEditor': 'none',
    'security.workspace.trust.enabled': false,
    'stitch.gameMaker.disableGameMakerUpdatePrompt': true,
  }),
);

// When run from a VS Code terminal, this makes VS Code start as plain Node
delete process.env.ELECTRON_RUN_AS_NODE;

let exitCode = 0;
try {
  await runTests({
    vscodeExecutablePath: process.env.STITCH_TEST_VSCODE || undefined,
    extensionDevelopmentPath: extensionDir,
    extensionTestsPath: path.join(extensionDir, 'out', 'test', 'index.cjs'),
    launchArgs: [
      workspace,
      '--disable-extensions',
      `--user-data-dir=${userDataDir}`,
      '--new-window',
      '--skip-welcome',
      '--skip-release-notes',
    ],
    extensionTestsEnv: {
      STITCH_TEST_PROJECT_DIR: projectDir,
    },
  });
} catch (err) {
  console.error((err as Error).message);
  exitCode = 1;
} finally {
  if (process.env.STITCH_TEST_KEEP) {
    console.log(`Kept the test workspace at ${tmp}`);
  } else {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}
process.exit(exitCode);
