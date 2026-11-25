# Mac Update Plan

The "launcher" package has draft macOS support. It was written from unpacked `.pkg` files and disassembled IDE code, and has never run on a Mac (see [Design Notes](./NOTES.md#macos-and-linux)). This file is the plan for testing it on macOS and fixing what breaks. It also logs discoveries until they are confirmed and moved into the [Design Notes](./NOTES.md) with an evidence tag (`[observed]`, `[experiment]`, …).

**Done means:** every item in the [Checklist](#checklist) is confirmed, corrected or explicitly left open, and the [Scenarios](#phase-3-end-user-scenarios) work on a real Mac.

## Environment

Record this for every test session, because NOTES.md dates and versions every finding.

| Item                      | Value                                                 |
| ------------------------- | ----------------------------------------------------- |
| Date                      | 2026-11-24                                            |
| macOS version             | 27.0.1 (build 26A434)                                 |
| CPU (arm64 / x86_64)      | arm64 (Apple M5 Max)                                  |
| Node version              | v24.18.0                                              |
| Homebrew                  | 7.0.16                                                |
| 7-Zip build (`7zz i`)     | **Not installed** (no `7zz`, `7z` or `7za` on `PATH`) |
| IDE version(s) tested     | (none yet)                                            |
| Runtime version(s) tested | (none yet)                                            |

Existing official GameMaker installs on this machine (in `/Applications`, read from each app's `Info.plist`):

| App                      | Version         | Bundle ID                  |
| ------------------------ | --------------- | -------------------------- |
| `GameMaker.app`          | 2024.11.0.179   | `com.yoyogames.gms2`       |
| `GameMaker CL2.app`      | 2024.14.0.207   | `com.yoyogames.gms2`       |
| `GameMaker Beta.app`     | 2026.100.0.1199 | `com.yoyogames.gms2-beta`  |
| `GameMaker LTS 2026.app` | 2026.0.0.16     | `com.yoyogames.gm-lts2026` |

Existing GameMaker dirs:

- **System dirs** (`/Users/Shared/`): `GameMakerStudio2`, `GameMakerStudio2-Beta`, `GameMakerStudio2-LTS2026` (plus `GameMakerDumps`). The runtimes cached there:
  - `GameMakerStudio2`: 2024.11.0.226, 2024.11.0.227, 2024.14.0.251
  - `GameMakerStudio2-Beta`: 2026.100.0.1071 through 2026.100.0.1135 (10 runtimes, including 1133)
  - `GameMakerStudio2-LTS2026`: 2026.0.0.23
- **User dirs**: the same three names exist in both `~/Library/Application Support/` and `~/.config/`.

**Before Phase 2:** back up `/Users/Shared/GameMakerStudio2*` and `~/Library/Application Support/GameMakerStudio2*` (and `~/.config/GameMakerStudio2*` if it exists). The launcher changes `default_macros.json` and file permissions there.

## Phase 1: Unit suite on macOS

Run `pnpm test` in this package and classify each failure:

- **Harness:** the test simulates another OS and breaks on a macOS host. Fix the test, never the product code. For example, "windows layout" tests use `path.win32.join` on a POSIX temp root, which writes dirs like `\var\folders\…\ProgramData\…` into the package dir.
- **Product:** a real bug in the cross-OS logic. Fix the code and add a regression test.

Unit tests only simulate layouts with fake dirs, so passing them says little about real macOS behavior.

### Results (2026-11-24) ✅ Done

**First run:** 71 tests, 62 passed, 9 failed. All 9 were **harness** failures, with no product bugs:

- **Cause:** every failing test forced `os: 'windows'` while creating real files (7 in `ideCache.test.ts`, 2 in `runtimes.test.ts`). The `os` option is documented as test-only, so product code never uses a foreign layout.
- **Layouts that work:** the mac and linux layout tests already passed. POSIX paths built on a POSIX host are fine.

**Fixes** (test code only):

- `src/test/helpers.ts`:
  - `sandboxedOs()` picks a layout whose GameMaker dirs all come from `testOptions`' temp env: `windows` on Windows, `linux` elsewhere. It's never `mac`, because the mac layout hardcodes the system dir to `/Users/Shared` (see the incident below).
  - `layoutSkipReasonForWindowsExclusiveTests()` skips Windows-layout file tests on non-Windows hosts and provides a reason to display.
  - `igorRelativePath(os)` gives the Igor path inside a runtime dir for each OS.
- `ideCache.test.ts`:
  - The layout loop covers all three OSes, and the Windows case is skipped on macOS. The mac case only reads from the temp IDE cache, so it's safe.
  - The test for caches made by old Stitch versions only runs on Windows, since those copies only existed there.
  - The generic cache tests (partial extractions, no feed, sizes, pruning, leftovers) use `sandboxedOs()`.
- `runtimes.test.ts`: both runtime-listing tests use `sandboxedOs()` and that OS's Igor path.
- `versions.test.ts`: these tests used the native layout, which reads real `/Users/Shared` on a Mac. They now use `sandboxedOs()` too.

**After the fixes:** 71 tests, 69 passed, 0 failed, 2 skipped (the Windows-only tests above). `tsc --noEmit` is clean. Running the suite again changed nothing under `/Users/Shared/GameMakerStudio2*` or `~/Library/Application Support/GameMakerStudio2*`.

**Leftovers:** 22 stray backslash-named dirs (26 empty fixture files) from the earlier runs are still in the package dir and can be deleted. The new runs created none.

### ⚠️ Incident: tests wrote into real GameMaker dirs (2026-11-24)

The first version of the fix ran `runtimes.test.ts` in the native (mac) layout. Because the mac system dir is hardcoded to `/Users/Shared`, the tests wrote fake runtimes into the machine's real GameMaker dirs. The second run then saw the first run's leftovers and failed, which exposed the problem.

- **Created** (fake, safe to delete):
  - `GameMakerStudio2-Beta/Cache/runtimes/runtime-{2024.1400.3.933,2026.0.0.10,2026.100.0.1199,2026.100.0.1200,not-a-version}`
  - `GameMakerStudio2-LTS2026/Cache/runtimes/runtime-{2026.0.0.10,2026.1.0.28}`
  - `GameMakerStudio2-Beta/Cache/runtimes/runtime-2026.100.0.1133/bin/igor/osx/x64/` (inside the real runtime; the real `arm64` Igor is intact)
- **Overwritten** (the original contents are lost):
  - `GameMakerStudio2-Beta/Cache/runtimes/runtime-2026.100.0.1133/receipt.json`
  - `GameMakerStudio2-Beta/runtime.json`
- **Repair:**
  - Delete the fake dirs.
  - Reinstall runtime 1133. One way is to delete `runtime-2026.100.0.1133` and boot the Beta 1199 IDE, which installs its paired runtime on boot.
  - The IDE also rewrites `runtime.json` on boot.
- **Repair status (2026-11-24):** the fake dirs and `runtime-2026.100.0.1133` were deleted. ⏳ To finish, open the Beta 1199 IDE once so it reinstalls runtime 1133 and rewrites `runtime.json`.
- **Lesson:** the mac layout can't be sandboxed through `platformEnv`. Any test that writes files must use `sandboxedOs()`.

### Open: flaky Igor cache test

`igor.test.ts` "prunes manually and reports sizes" failed once in 8 runs: `info.every((e) => e.sizeBytes >= 4 && e.meta)` was false. The test is untouched by these changes, so the flakiness predates them. It still needs investigating.

## Phase 2: Integration on macOS

These run the opt-in suites in [`src/integration.test.ts`](./src/integration.test.ts), in order of increasing risk:

1. `STITCH_LAUNCHER_INTEGRATION=1`
   - prerequisites
   - 7-Zip detection
   - runtime discovery
   - Igor `PackageZip`/`Run`, including Igor's exec bits and quarantine
2. `STITCH_LAUNCHER_INTEGRATION_INSTALL=1`
   - pkg → Xar → `Payload` → cpio extraction
   - whether the extracted `.app` runs (Gatekeeper, quarantine, symlinks)
3. `STITCH_LAUNCHER_INTEGRATION_IDE=1`
   - opening a project
   - process tracking (the IDE is a child of the `Contents/MacOS/GameMaker` stub)
   - suppressing and restoring the update prompt
   - the runtime installing on boot

### Step 1 results: runtimes and Igor (2026-11-24)

- **Runtimes and prerequisites:** ✅ pass. 7-Zip is found at `/opt/homebrew/bin/7zz`.
- **Packaging the sample project:** ❌ blocked. The sample is saved in the 2022.600 format, which Igor can't load. With `STITCH_LAUNCHER_IDE_VERSION=2026.100.0.1199`, Igor runs but rejects every `.yy` file, and about a third of the time it crashes with `SIGABRT` (see [Discoveries](#discoveries)). This step needs a sample saved by a recent IDE.

### Step 2 results: installing an IDE (2026-11-25)

**The suite passes** (`STITCH_LAUNCHER_INTEGRATION_INSTALL=1 STITCH_LAUNCHER_IDE_VERSION=2026.100.0.1199`), in 18.5 s, including the download of the 466 MB pkg into `~/Downloads`. But it only checks that the executable exists and that a paired runtime was found. Inspecting an extracted copy shows:

- ✅ **Layout:** `GameMaker Beta.app` sits directly in `gamemaker-2026.100.0.1199/`. The channel is `beta`, the `program_dir_name` is `GameMakerStudio2-Beta`, and `Info.plist` gives version 2026.100.0.1199 and ID `com.yoyogames.gms2-beta`.
- ✅ **Permissions:** exec bits survive; all 886 executables match the `/Applications` install.
- ✅ **Files:** `matching.runtime` (`2026.100.0.1133`) and `helpdocs_keywords.json` are where `mac.ts` expects.
- ✅ **No quarantine:** the extracted files only get `com.apple.provenance`.
- ❌ **The code signature is broken.**
  - The pkg payload stores each file's extended attributes as AppleDouble data. 7-Zip writes that data out as 8,186 extra `._<name>` files instead of applying it, so the bundle holds 16,453 files against 8,267 in `/Applications`.
  - Those attributes are the per-file code signatures (`com.apple.cs.CodeDirectory`, `CodeRequirements` and `CodeSignature`) that non-Mach-O files in `Contents/MacOS` need.
  - Result: `codesign --verify --deep --strict` says "code object is not signed at all", and `spctl` rejects the app.
  - Deleting the `._*` files doesn't help (the signatures are then missing), and neither does `dot_clean -m`, which removes them without restoring the `com.apple.cs.*` attributes.
  - Risks besides Gatekeeper: stray files like `._Alice.dll` and `._Alice.gmplugin` sit next to real plugins and assemblies.
- ✅ **Fix candidate: `pkgutil --expand-full <pkg> <dir>`.**
  - It's built into macOS, needs no root, and runs no install scripts. It took 7.5 s.
  - The resulting `GameMakerStudio2-Installer.pkg/Payload/GameMaker Beta.app` has no `._*` files and keeps the `com.apple.cs.*` attributes. `codesign` reports "valid on disk", and `spctl` accepts it as "Notarized Developer ID".
  - **Implication:** on macOS the launcher could drop 7-Zip entirely, using `pkgutil --expand-full` to extract and `pkgutil --check-signature` to verify. That would change the "7-Zip is a user-installed dependency" design note for Mac.

**Fixed 2026-11-25.** macOS no longer uses 7-Zip:

- **`mac.ts`:**
  - `extractInstaller` runs `pkgutil --expand-full` and moves the `.app` out of the payload.
  - `verifyInstaller` runs `pkgutil --check-signature` and requires an Apple-issued signature from YoYo Games' Team ID `C9E7J7HL3D`. The output is parsed by `parsePkgSignature`, which has unit tests in `mac.test.ts`.
- **`PlatformLayer`:** the 7-Zip settings are grouped into an optional `sevenZip` requirement, which Windows and Linux declare and macOS doesn't.
- **On macOS:**
  - `installIde` and `checkPrerequisites` skip 7-Zip entirely. `Prerequisites.sevenZip` is `undefined` there.
  - `findSevenZip` throws `NOT_SUPPORTED`.
  - `sevenZipPath` is ignored.
- **Tests:** the install integration test now also runs `codesign --verify --deep --strict` on the extracted app on macOS. It passes, in 15 s.
- **Docs:** NOTES.md, the launcher README, the `sevenZipPath` option doc, and the VS Code 7-Zip setting description are updated.

## Phase 3: End-user scenarios

- On a Mac missing a dependency (e.g. 7-Zip), the launcher names what's missing and how to install it.
- From the VS Code extension, the user can switch the IDE and runtime versions easily.
- From the VS Code extension, the user can run a GameMaker project without opening the IDE.

### Scenario 1 results: missing 7-Zip (2026-11-24)

**Launcher library: ✅ passes.** The real launcher code was run on this Mac (no `7zz`, `7z` or `7za` anywhere), with temp state, cache and download dirs and `fetch` wrapped to log requests:

- **`checkPrerequisites()`** returns a `SEVEN_ZIP_MISSING` error. It doesn't throw.
- **`installIde('2026.100.0.1199')`** throws the same error after about 1 ms. It makes **no network requests** (no feed fetch, no download) and creates no files.
- **The message** is: "Stitch needs 7-Zip to extract GameMaker installers, but could not find it. Install the full 7-Zip from https://www.7-zip.org/download.html (or run `brew install sevenzip`), or set Stitch's 7-Zip path setting." `data.requiredFormat` is `Xar`.
- **A `sevenZipPath` pointing nowhere** gives `7-Zip was not found at "<path>".`, and the hint no longer mentions the path setting.
- **A 7-Zip without Xar support** (a fake `7zz` reporting v16.02 with only 7z/zip) gives `SEVEN_ZIP_INCAPABLE`. The message names the binary and its version.
- **Homebrew:** the `sevenzip` formula exists (26.06). Whether it installs `7zz` with Xar support is still unchecked.

**VS Code extension: ⏳ needs a manual check.** The error only appears from **Open in GameMaker** (`openInIde`, in `packages/vscode/src/extension.project.mts`), and only when the project's IDE version isn't already in Stitch's IDE cache. To check it, run that command in VS Code on such a project. It should show the message with three buttons (handled by `showLauncherError` in `extension.launcher.mts`):

- **Open 7-Zip download page** opens the download page.
- **Copy install command** copies `brew install sevenzip`.
- **Set 7-Zip path** opens the setting.

**Update 2026-11-25:** macOS no longer needs 7-Zip (see [Phase 2 step 2](#step-2-results-installing-an-ide-2026-11-25)), so this scenario no longer applies on a Mac. The 7-Zip error and the VS Code buttons still apply on Windows and Linux. No other Mac dependency is known so far.

**Gaps:**

- The extension never calls `checkPrerequisites()`, so a missing 7-Zip is only reported when an install is attempted, not up front.
- Projects whose IDE version is already cached work without 7-Zip, which is expected.

## Checklist

For each item, mark one of: ✅ confirmed (remove the `TODO(verify)` marker and tag the fact in NOTES.md), ✏️ corrected (fix the code and NOTES.md), or ⏸ still open.

From `TODO(verify)` markers:

- [ ] App names and channel mapping; LTS2026's `program_dir_name` is `GameMakerStudio2-LTS2026` (`mac.ts:27`)
- [x] ~~`brew install sevenzip` provides `7zz` with Xar/Cpio support.~~ Confirmed 2026-11-24, then moot since 2026-11-25: macOS no longer needs 7-Zip.
- [ ] System dir is `/Users/Shared/<pdn>` (`mac.ts:48`)
- [ ] User dir is `~/Library/Application Support/<pdn>`; does `um.json` land there or in `~/.config`? (`mac.ts:50`)
- [ ] Igor is at `<runtime>/bin/igor/osx/{arm64,x64}/Igor` (`mac.ts:65`). Partly confirmed 2026-11-24: the arm64 path exists and runs in IDE-installed runtimes. It has its exec bit set, no quarantine xattr, and a YoYo Games Developer ID signature (`C9E7J7HL3D`). The x64 path is unchecked.
- [ ] Running the stub with a project path opens the project, or `open -a` is needed (`mac.ts:93`)
- [x] ✅ `matching.runtime` is at `Contents/MacOS/<arch>/` (`mac.ts:97`). Confirmed 2026-11-25 in the extracted 1199 bundle: `2026.100.0.1133`.
- [x] ✅ Help keywords location in the bundle (`mac.ts:99`). Confirmed 2026-11-25: `Contents/MacOS/arm64/RoboHelp/helpdocs_keywords.json`.
- [ ] Extracted `.app` runs: permissions, symlinks, Gatekeeper, quarantine (`mac.ts:105`). 7-Zip extraction broke the code signature. **Fixed 2026-11-25** by switching to `pkgutil --expand-full`: exec bits, a valid signature and no quarantine are confirmed. Launching it is step 3.
- [x] ✅ Exec bits survive cpio extraction (`mac.ts:132`). Confirmed 2026-11-25: all 886 executables match `/Applications`.
- [x] ✅ Pkg signature check (`mac.ts`). Implemented 2026-11-25 with `pkgutil --check-signature`, requiring Team ID `C9E7J7HL3D`. The 1199 pkg passes, and the parser rejects an unsigned pkg's output.
- [ ] `chmod 0777` of the system dir matches the pkg postinstall (`mac.ts:151`)
- [ ] Process names and paths from `ps` (`mac.ts:166`)
- [ ] 7-Zip `-snl` behavior with cpio/tar payloads (`posix.ts:21`)

From NOTES.md open questions:

- [ ] Does `GM_RESTART=0` stop the post-install launch? (Only relevant if the official installer is used for prerequisites.)
- [ ] Does the IDE install its runtime on a plain boot, without `--runtime`?
- [ ] Does a CLI project open work when an IDE of the same channel is already running?

## Discoveries

Dated findings, moved into NOTES.md once confirmed.

- Running `pnpm test` on macOS creates dirs like `packages/launcher/\var\folders\…\stitch-launcher-test-XXXX\ProgramData\GameMakerStudio2-Beta\Cache\runtimes`. Cause: "windows layout" tests compute paths with `path.win32` from a POSIX temp root, which gives a relative, backslash-named path under the cwd. This is a harness bug. **Fixed 2026-11-24** (see [Phase 1 results](#results-2026-11-24--done)).
- **2026-11-24, first Igor run on macOS** (`STITCH_LAUNCHER_IDE_VERSION=2026.100.0.1199`, runtime 1133, `mac PackageZip` of `samples/project`):
  - **Igor runs.** The launcher picked `bin/igor/osx/arm64/Igor`, and Gatekeeper didn't block it. Igor read `local_settings.json` from `~/Library/Application Support/GameMakerStudio2-Beta/<user>/`, which supports `Application Support` (not `~/.config`) as the Mac user dir.
  - **The sample project can't be built.** It's saved in the 2022.600 format, and Igor's asset compiler rejects every `.yy` file with `A type tag field is required…`. That's the same failure NOTES.md records on Windows. This test needs a sample project saved by a recent IDE.
  - **Igor sometimes aborts instead of exiting.** In about 1 of 3 runs, Igor dies from `SIGABRT` (exit code `null`) instead of exiting with code 1. This happened with and without the test runner, so it's GameMaker's crash on the error path, not the launcher's. macOS crash report: an unhandled .NET exception → `abort()`.
  - **Launcher gap:** `runIgor` drops the signal (`close` gives `(code, signal)`, and only `code` is kept). A crashed Igor then shows up only as `null !== 0`. `IgorResult` should include `signal`.
