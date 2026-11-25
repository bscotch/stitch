# Mac Update Plan

The "launcher" package has draft macOS support. It was written from unpacked `.pkg` files and disassembled IDE code, and has never run on a Mac (see [Design Notes](./NOTES.md#macos-and-linux)). This file is the plan for testing it on macOS and fixing what breaks. It also logs discoveries until they are confirmed and moved into the [Design Notes](./NOTES.md) with an evidence tag (`[observed]`, `[experiment]`, …).

**Done means:** every item in the [Checklist](#checklist) is confirmed, corrected or explicitly left open, and the [Scenarios](#phase-3-end-user-scenarios) work on a real Mac.

## Environment

Record this for every test session, because NOTES.md dates and versions every finding.

| Item                      | Value                                                  |
| ------------------------- | ------------------------------------------------------ |
| Date                      | 2026-11-24                                             |
| macOS version             | 27.0.1 (build 26A434)                                  |
| CPU (arm64 / x86_64)      | arm64 (Apple M5 Max)                                   |
| Node version              | v24.18.0                                               |
| Homebrew                  | 7.0.16                                                 |
| 7-Zip build (`7zz i`)     | **Not installed** (no `7zz`, `7z` or `7za` on `PATH`)  |
| IDE version(s) tested     | (none yet)                                             |
| Runtime version(s) tested | (none yet)                                             |

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

## Phase 3: End-user scenarios

- On a Mac missing a dependency (e.g. 7-Zip), the launcher names what's missing and how to install it.
- From the VS Code extension, the user can switch the IDE and runtime versions easily.
- From the VS Code extension, the user can run a GameMaker project without opening the IDE.

## Checklist

For each item, mark one of: ✅ confirmed (remove the `TODO(verify)` marker and tag the fact in NOTES.md), ✏️ corrected (fix the code and NOTES.md), or ⏸ still open.

From `TODO(verify)` markers:

- [ ] App names and channel mapping; LTS2026's `program_dir_name` is `GameMakerStudio2-LTS2026` (`mac.ts:27`)
- [ ] `brew install sevenzip` provides `7zz` with Xar/Cpio support (`mac.ts:40`)
- [ ] System dir is `/Users/Shared/<pdn>` (`mac.ts:48`)
- [ ] User dir is `~/Library/Application Support/<pdn>`; does `um.json` land there or in `~/.config`? (`mac.ts:50`)
- [ ] Igor is at `<runtime>/bin/igor/osx/{arm64,x64}/Igor` (`mac.ts:65`)
- [ ] Running the stub with a project path opens the project, or `open -a` is needed (`mac.ts:93`)
- [ ] `matching.runtime` is at `Contents/MacOS/<arch>/` (`mac.ts:97`)
- [ ] Help keywords location in the bundle (`mac.ts:99`)
- [ ] Extracted `.app` runs: permissions, symlinks, Gatekeeper, quarantine (`mac.ts:105`)
- [ ] Exec bits survive cpio extraction (`mac.ts:132`)
- [ ] Pkg signature check, e.g. `pkgutil --check-signature` (`mac.ts:144`)
- [ ] `chmod 0777` of the system dir matches the pkg postinstall (`mac.ts:151`)
- [ ] Process names and paths from `ps` (`mac.ts:166`)
- [ ] 7-Zip `-snl` behavior with cpio/tar payloads (`posix.ts:21`)

From NOTES.md open questions:

- [ ] Does `GM_RESTART=0` stop the post-install launch? (Only relevant if the official installer is used for prerequisites.)
- [ ] Does the IDE install its runtime on a plain boot, without `--runtime`?
- [ ] Does a CLI project open work when an IDE of the same channel is already running?

## Discoveries

Dated findings, moved into NOTES.md once confirmed.

- Running `pnpm test` on macOS creates dirs like `packages/launcher/\var\folders\…\stitch-launcher-test-XXXX\ProgramData\GameMakerStudio2-Beta\Cache\runtimes`. Cause: "windows layout" tests compute paths with `path.win32` from a POSIX temp root, which gives a relative, backslash-named path under the cwd. This is a harness bug.
