# Stitch for VSCode: end-to-end tests

These tests run inside a real VS Code (an Extension Development Host), and use the extension the way a user would: through VS Code's commands and language features, and the asset tree.

```sh
pnpm test
```

This builds the extension and the tests, then runs them on a temporary copy of [`../parser/samples/project`](../../parser/samples/project). The webviews must have been built at least once first (`pnpm build`).

- **VS Code:** the first run downloads the latest stable VS Code into `.vscode-test/`. To use an installed copy instead, set `STITCH_TEST_VSCODE` to its executable (e.g. `C:\Users\you\AppData\Local\Programs\Microsoft VS Code\Code.exe`).
- **The test workspace:** the sample project is in a subfolder of the workspace (as in #294), with a prefab `.yyp` next to it (as in #291), so every run checks that the right project is found. Set `STITCH_TEST_KEEP=1` to keep the workspace afterwards.
- **No other extensions** are loaded, and VS Code uses a fresh profile with the settings in `runTests.mts`.

## Writing tests

Tests are [mocha](https://mochajs.org/) tests (`describe`/`it`) in `e2e/*.test.mts`. They're bundled into `../out/test/` and run in file-name order, in a single VS Code window. Later files can rely on what earlier ones did, so tests that change the project go in the last file (`03-project.test.mts`).

- Use VS Code's commands to exercise features as the editor would, e.g. `vscode.executeHoverProvider`, `vscode.executeDefinitionProvider` or `vscode.executeCompletionItemProvider`.
- `e2e/lib.mts` has helpers:
  - `getWorkspace()` and `getProject()`: the extension's workspace (from its `activate()`) and the loaded project, with `project.gm` (its `@bscotch/gamemaker-project`) and `project.client` (the language client);
  - `openDocument()`, `setText()` and `revert()`: work with project files, without saving changes;
  - `positionOf()`: a position in a document, by text;
  - `waitFor()`: retry until something is true. The language server and the project follow changes asynchronously, so use it after changing things;
  - `treeItems()` and `treeAsset()`: the asset tree's contents.
- Revert documents you edit (in a `finally`), so later tests see the files on disk.
