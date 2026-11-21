# Design Notes

How GameMaker IDE and Runtime installs work, how the current launcher interacts with them, and the design for the overhauled launcher.

Researched November 2026 on Windows 11. Three installs were already present: Monthly 2024.13.1.193, Beta 2024.1400.3.957, and LTS2022 2022.0.0.19. Experiments used Beta 2026.100.0.1199 (runtime 2026.100.0.1133) and Beta 2024.1400.0.904. GameMaker changes these things without notice, so treat specifics as "true when written".

Each claim is marked with how it was established:

- **[observed]**: seen on disk, in the registry, or in `ui.log`.
- **[experiment]**: from a controlled test, described in [Experiments](#experiments).
- **[unverified]**: inferred or reported, not confirmed.

## How GameMaker decides where things go

Each channel's IDE has its own name compiled into its "branding" assembly, `GameMaker[-<Channel>].dll`. That name is the `program_dir_name` macro: `GameMakerStudio2`, `GameMakerStudio2-Beta` or `GameMakerStudio2-LTS`. **[observed]**: it's a UTF-16 string in each branding DLL, including the cached copies.

The IDE's own `defaults/default_macros.json` derives every working directory from that name. The paths come from .NET special folders:

| Macro                    | Definition                                     | Windows value                                               |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------- |
| `system_directory`       | `${CommonApplicationData}/${program_dir_name}` | `C:\ProgramData\GameMakerStudio2-Beta`                      |
| `system_cache_directory` | `${system_directory}/Cache`                    | `C:\ProgramData\GameMakerStudio2-Beta\Cache`                |
| `local_directory`        | `${ApplicationData}/${program_dir_name}`       | `%APPDATA%\GameMakerStudio2-Beta`                           |
| `temp_directory`         | `${TempPath}/${program_dir_name}`              | (observed: `%LOCALAPPDATA%\GameMakerStudio2-Beta\GMS2TEMP`) |
| `my_projects_directory`  | `${UserProfile}/GameMakerProjects`             | `%USERPROFILE%\GameMakerProjects`                           |

`<system_directory>/default_macros.json` is merged over these defaults, if it exists. Users and Stitch use it to override `updateURI` (the IDE update feed) and `runtimeURI` (the runtime feed).

**Consequences:**

- **Where the IDE runs from doesn't matter.** A copy of a Beta IDE anywhere on disk uses the Beta system and user dirs. **[experiment]** The extracted 1199 and the cached 904 both used `GameMakerStudio2-Beta`. Every cached version of a channel shares one runtime cache, one login, and one set of preferences.
- **We can compute every directory** from the channel (which gives `program_dir_name`) plus the per-OS meaning of the .NET special folders. No discovery is needed.
- The v2 feed's `channels[].userDirSuffix` is the suffix on `program_dir_name`. It applies to the system dir as well as the user dir.

## Windows layout

| Channel            | Exe / branding DLL                          | Default install dir                                                          | `program_dir_name`                        |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| `monthly`          | `GameMaker.exe/.dll`                        | `C:\Program Files\GameMaker`                                                 | `GameMakerStudio2`                        |
| `beta`, `unstable` | `GameMaker-Beta.exe/.dll`                   | `C:\Program Files\GameMaker-Beta`                                            | `GameMakerStudio2-Beta`                   |
| `lts2022`          | `GameMaker-LTS.exe/.dll`                    | `C:\Program Files\GameMaker-LTS`                                             | `GameMakerStudio2-LTS`                    |
| `lts2026`          | `GameMaker-LTS2026.exe/.dll` **[observed]** | **[unverified]** `C:\Program Files\GameMaker-LTS2026` (irrelevant to Stitch) | `GameMakerStudio2-LTS2026` **[observed]** |

Older installs used different default dir names, e.g. `GameMaker Studio 2-Beta`. A Start Menu folder with that name still exists on this machine. Never assume the default dir: use the registry ([Installer](#installer)).

### IDE install dir

| Path                              | Notes                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameMaker[-<Ch>].exe`            | The launcher stub. **It relaunches itself:** the PID you spawn exits within seconds and a new process becomes the real IDE. **[experiment]**               |
| `GameMaker[-<Ch>].dll`, `IDE.dll` | The PE version metadata (`FileVersion`/`ProductVersion`) is the IDE version on the `.exe` and on both DLLs. **[observed]** No binary regex scan is needed. |
| `matching.runtime`                | The paired runtime version, plain text with a trailing space. It's in the installer payload, so it exists before the first boot. **[observed]**            |
| `defaults/default_macros.json`    | The macro table described above.                                                                                                                           |
| `RoboHelp/helpdocs_keywords.json` | Used by the parser for help links.                                                                                                                         |
| `uninstall.exe`                   | Created by the installer, and **not** in the payload.                                                                                                      |

### System dir (`C:\ProgramData\<program_dir_name>`)

| Path                                                  | Notes                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime.json`                                        | **Owned by the IDE.** Format: `{"active": "<ver>", "<ver>": "<dir>&<feedUrl>"}`. On every boot the IDE sets `active` to its paired runtime and prunes the list. **[experiment]** Entries without `&…` were written by Stitch. Entries can point into _another_ channel's runtime cache. |
| `runtime_feeds.json`                                  | `[{Key, Value}]`. On boot the IDE makes sure `Master` equals the effective `runtimeURI`, recreating the file if it's empty. **[experiment]** Any other entries only add choices in the IDE's Runtime Feeds preferences.                                                                 |
| `default_macros.json`                                 | User/tool overrides of the IDE's macros. It's not created by the IDE.                                                                                                                                                                                                                   |
| `ui.log` (+ rotated `ui-*.gz`)                        | The IDE log. Useful for debugging: it logs the command-line args, runtime installs, and update checks.                                                                                                                                                                                  |
| `Cache/runtimes/runtime-<ver>/`                       | Installed runtimes (details below).                                                                                                                                                                                                                                                     |
| `Skins/`, `Themes/`, `Dumps/`, `Prefabs/`, `Plugins/` | Not relevant to the launcher.                                                                                                                                                                                                                                                           |

### Runtime dir (`Cache/runtimes/runtime-<ver>/`)

| Path                            | Notes                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bin/igor/windows/x64/Igor.exe` | The only Igor location in any runtime on this machine, 2022.0 through 2026.100. **[observed]** The old `bin/Igor.exe` fallback is obsolete.                                                      |
| `receipt.json`                  | The installed modules (`base`, `base-module-windows-x64`, `windows`, `windowsYYC`, `operagx`, …), each with its source zip URI and version. **This tells us which targets a runtime can build.** |
| `Windows/x64/Runner.exe`        | The VM runner that `Run` launches.                                                                                                                                                               |
| `GmlSpec.xml`                   | Used by the parser.                                                                                                                                                                              |
| `BaseProject/`                  | Now only `options/`; there's no template `.yyp` anymore.                                                                                                                                         |

Incomplete runtime dirs exist, e.g. one containing only `download/`, or one with module folders but no Igor. **Treat a runtime as installed only if both Igor and `receipt.json` exist.** Never delete these dirs: they may be downloads in progress.

### User dir (`%APPDATA%\<program_dir_name>`)

| Path                         | Notes                                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `um.json`                    | The current login. The user subdir name is `<login before '@'>_<userID>`. **[observed]** `username` doesn't match. It also contains tokens: never log or copy it. |
| `<login>_<userID>/`          | Per-user data.                                                                                                                                                    |
| `…/licence.plist`            | Used by Igor (the default for `--lf`).                                                                                                                            |
| `…/devices.json`             | Used by Igor (the default for `--df`).                                                                                                                            |
| `…/local_settings.json`      | Preferences. Includes `machine.Runtime Feeds.Saved Modules Selection` (e.g. `base;windows;windowsYYC`), which controls which modules the IDE downloads.           |
| `unknownUser_unknownUserID/` | Used while logged out.                                                                                                                                            |

### Elsewhere

- **Registry**, all under **HKCU** even though the installer runs elevated:
  - `HKCU\SOFTWARE\GameMakerStudio2<suffix>` has `Install_Dir`, the remembered install location, and `Installer Language`.
  - `HKCU\…\Uninstall\GameMakerStudio2<suffix>` has `DisplayVersion` (the installed IDE version) and `UninstallString`. `InstallLocation` is empty.
- **Start Menu:** `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\GameMaker[-<Ch>]\`
- **gmpm packages:** `%USERPROFILE%\gmpm[-beta]\`. GameMaker's package manager uses it for IDE tool packages such as `@gm-tools/project-tool-win-x64`. New IDEs create it.
- **Temp:** `%LOCALAPPDATA%\<program_dir_name>\GMS2TEMP`, deleted when the IDE exits.

## macOS and Linux

Nothing here was tested on a real Mac or Linux machine. Sources:

- **[package]**: unpacked from the 2026.100.0.1199 `.pkg`/`.deb`, the LTS2026 2026.1.0.27 `.deb`, the 1133 runtime module zips, and package metadata for other channels.
- **[IL]**: disassembled IDE code (`Utils.dll`, `IDE.dll`, `OSCore.dll`).

The macro scheme is the same: `default_macros.json` is byte-identical to Windows, and `program_dir_name` is in the branding `GameMaker.dll`. What differs per OS is the special folders:

| Macro source            | macOS                                                                                          | Linux                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `CommonApplicationData` | Hardcoded `/Users/Shared` **[IL]**                                                             | Set to `LocalApplicationData` = `$XDG_DATA_HOME` or `~/.local/share` **[IL]** |
| `ApplicationData`       | `~/Library/Application Support` (.NET 8). The IDE migrates `~/.config/<pdn>` into it. **[IL]** | `$XDG_CONFIG_HOME` or `~/.config` (.NET)                                      |
| `TempPath`              | `/tmp` **[IL]**                                                                                | `/tmp` **[IL]**                                                               |

| Fact                | macOS                                                                                                                                                                                                                                                                                            | Linux                                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channels available  | All                                                                                                                                                                                                                                                                                              | Only `beta`/`unstable` and `lts2026`                                                                                                                                                                                                                                       |
| Install             | `sudo installer -pkg X.pkg -target /`. Installs to `/Applications` only (`relocatable="false"`, needs root). Postinstall **launches the IDE** as the console user with `--runtime <ver>`, unless a `gm_install_vars.sh` with `GM_RESTART=0` sits next to the pkg **[package; skip unverified]**. | `sudo apt install ./X.deb`. Installs to `/opt/<pkg>/` plus a `.desktop` file and MIME types. Postinst only loads an AppArmor profile. **[package]**                                                                                                                        |
| App / package names | Monthly `GameMaker.app` (`com.yoyogames.gms2`); Beta and Unstable `GameMaker Beta.app` (`com.yoyogames.gms2-beta`); LTS2022 `GameMaker LTS.app` (`com.yoyogames.gm-lts`); LTS2026 `GameMaker LTS 2026.app` (`com.yoyogames.gm-lts2026`) **[package]**                                            | `GameMaker-Beta`, `GameMaker-LTS2026` (installed under `/opt/GameMaker-Beta` and `/opt/GameMaker-LTS2026`) **[package]**                                                                                                                                                   |
| Pkg file names      | `GameMaker-<ver>.pkg` for **every** channel; only the version (and the package ID inside) tells them apart                                                                                                                                                                                       | Channel in the name                                                                                                                                                                                                                                                        |
| Executable          | `Contents/MacOS/GameMaker`, a universal launcher that spawns `Contents/MacOS/{arm64,x86_64}/GameMaker`, so it's another child process                                                                                                                                                            | `/opt/<pkg>/GameMaker`, a bash wrapper that `cd`s into `{x86_64,aarch64}/` and runs `./GameMaker ${@:1}`. **The arguments are unquoted**, so paths with spaces break, and the `cd` breaks relative paths. Prefer running `<arch>/GameMaker` directly with that dir as cwd. |
| Installed version   | `Contents/Info.plist` `CFBundleShortVersionString`, or `pkgutil --pkg-info <id>`                                                                                                                                                                                                                 | `dpkg-query -W -f='${Version}' <pkg>`, or the PE version of `<arch>/GameMaker.dll`                                                                                                                                                                                         |
| `matching.runtime`  | `Contents/MacOS/<arch>/matching.runtime`                                                                                                                                                                                                                                                         | `/opt/<pkg>/<arch>/matching.runtime`                                                                                                                                                                                                                                       |
| System dir (Beta)   | `/Users/Shared/GameMakerStudio2-Beta`                                                                                                                                                                                                                                                            | `~/.local/share/GameMakerStudio2-Beta`                                                                                                                                                                                                                                     |
| User dir (Beta)     | `~/Library/Application Support/GameMakerStudio2-Beta` (possibly `~/.config/…` on older IDEs)                                                                                                                                                                                                     | `~/.config/GameMakerStudio2-Beta`                                                                                                                                                                                                                                          |
| Igor                | `<runtime>/bin/igor/osx/{arm64,x64}/Igor` **[package]**                                                                                                                                                                                                                                          | `<runtime>/bin/igor/linux/{x64,arm64}/Igor` **[package]**                                                                                                                                                                                                                  |
| Coexistence         | One version per channel. Unstable overwrites Beta.                                                                                                                                                                                                                                               | Same                                                                                                                                                                                                                                                                       |
| Open a project      | `open -a "<app>" /abs/proj.yyp`, or run the launcher with the path. The plumbing is there; the behavior is unverified.                                                                                                                                                                           | `<arch>/GameMaker /abs/proj.yyp` (unverified)                                                                                                                                                                                                                              |

Notes:

- **Don't derive dir names from the Mac installer scripts.** They `chmod` `/Users/Shared/GameMaker-LTS*`, which doesn't match the IDE's `GameMakerStudio2-LTS*`.
- **Cached copies:** on Linux, `/opt/<pkg>/` is a self-contained dir and could be copied, or extracted from the `.deb` with `ar`/`tar`. On Mac, an `.app` bundle can be copied, but the pkg only installs to `/Applications`. Copying (or extracting from the pkg payload) needs testing, including Gatekeeper and quarantine.

## Installer

The Windows installer is **NSIS 3.11**, signed by YoYo Games Ltd, and requires admin. **[observed]** 7-Zip can't decompile its script (`BadCmd=13`), so any custom switches are unknown.

- **Switches:** `/S` (silent) and `/D=<dir>`. `/D=` must be the **last** argument and **unquoted**; spaces are fine. **[experiment]**
- **Exit code:** 0 on success. When started with `Start-Process -Wait`, it blocks until the install finishes (38 s for 1199).
- **Remembered location:** without `/D=`, it installs to `HKCU\SOFTWARE\GameMakerStudio2<suffix>\Install_Dir`, i.e. wherever that channel was last installed. **[experiment]**
- **Installing to a different dir** updates the registry and leaves the previous install untouched, so it's orphaned but still works. **[experiment]**
- **Installing to the same dir overlays files.** It doesn't clean the dir first: after installing 904 over 1199, 748 of the 749 files unique to 1199 were still there. **[experiment]** So a channel's install dir can hold a **mix of versions**. Copying it into a cache copies the mix, which the current `installIde` does. Downgrades are allowed.
- **Prerequisites:** the payload includes VC++ redistributables, which run from `$TEMP`. The IDE refuses to start without them, and the branding DLL contains an error message about this.
- **Uninstaller:** NSIS uninstallers copy themselves to `%TEMP%` and return immediately. Pass `_?=<install dir>` to run in place and wait.
- **Manual installs** follow the same rules. Users can install any channel anywhere, at any time, which moves `Install_Dir`. The launcher can't assume it caused the current state.

### Extracting the payload instead

`7z x -tNsis <installer> -o<dir> -x!$PLUGINSDIR -x!$TEMP` produces a working IDE dir. **[experiment]**

- It takes about 8 s, needs no admin, and writes nothing to the registry, Program Files, or Start Menu.
- The result is a clean single-version dir that includes `matching.runtime`.
- The extracted 1199 IDE booted normally, logged in, installed its runtime, and opened (offered to upgrade) a project passed on the command line.
- **Caveats:**
  - **It needs the _full_ 7-Zip build**: `7z.exe` + `7z.dll` on Windows (verified to work on their own), `7zz` on Mac/Linux. **[experiment]** The standalone `7za` build supports none of the formats we need: NSIS, Xar (`.pkg`), Ar (`.deb`) or Cpio. That's true of both the official 26.06 build and the `7zip-bin` npm package, which also bundles an old 21.07.
  - **Plan: 7-Zip is an external dependency the user installs.** We don't bundle it.
    - **Discovery order:** the config override (`sevenZipPath`), then PATH, then a known location per OS.
      - Windows: the registry `HKCU`/`HKLM\SOFTWARE\7-Zip` values `Path64`/`Path`, then `%ProgramFiles%\7-Zip\7z.exe`.
      - macOS: `7zz` on PATH (Homebrew).
      - Linux: `7zz`, then `7z`.
    - **Capability check:** run `<binary> i` and require the format for this OS: `Nsis` (Windows), `Xar` (macOS `.pkg`), `Ar` (Linux `.deb`). This rejects `7za`.
    - **Fail fast:** run the check at the start of `installIde`, before downloading anything. Throw an error that names what was found (if anything), links https://www.7-zip.org/download.html, and gives the OS-specific install command:
      - Windows: `winget install 7zip.7zip`
      - macOS: `brew install sevenzip` **[unverified]**
      - Linux: `sudo apt install 7zip`, or `p7zip-full` on older distros **[unverified]**
  - **It skips the VC++ redistributable install.** That's fine on any machine that has ever had GameMaker installed. Detect it via `HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64`, where `Installed` = 1. **[observed]** See [Design](#installing-an-ide-version) for what happens when it's missing.
  - It skips anything else the NSIS script does. Nothing missing was observed, but the script is unreadable. The things the installer does that we skip, none of which Stitch needs:
    - `.yyp`/`.yyz` file associations in HKLM (they point to whichever channel was installed last)
    - Start Menu shortcuts
    - registry `Install_Dir` and the uninstall entry
    - creating `C:\ProgramData\<pdn>` with an explicit `BUILTIN\Users` FullControl grant. Without the installer, the IDE creates that dir on first boot and it's writable only by that Windows user. That's fine on single-user machines; the launcher could create it with the same grant itself. **[observed]**

## Runtimes are installed by the IDE

On boot, during its `CheckingRSS` loading state, the IDE downloads and installs its `matching.runtime` from the effective `runtimeURI` feed, using the user's saved module selection. Then it sets `runtime.json.active`. **[experiment]**

- This took about 10 s for 1199, and it works for extracted and cached copies.
- It also worked with `runtime_feeds.json` emptied and the runtime dir deleted.
- **It doesn't require a login.** On a clean-slate LTS2026 boot it installed the runtime while still `unknownUser`, 26 s after launch. **[experiment]** With no saved module selection, it installed `base`, `windows` and `operagx`, but not YYC.
- The launcher should only _find_ runtimes, and tell the user to boot the IDE when the needed runtime is missing.

## Igor

Igor's `--help` exits with code 127 and prints `unkown option "--help"`, followed by the full usage text. The text captured in `scripts/parseIgorOpts.js` is out of date:

- **Added:**
  - targets `reddit` and `switch2`
  - commands `windows PackageZipArm64`, `PackageNsisArm64`, `xboxseriesxs DetermineVSVersion`, `android AndroidRun_Command`
  - per-platform `CleanCode`/`CleanGraphics`/`CleanAudio`, `PreGradleStep`, `PreCleanStep`/`PostCleanStep`
  - options `--launch`, `--nb/--nobuild`, `--pf/--prefabs`, `--pt/--projectool`, `--ssdk`, `--mqtt`
- **Removed:** `winuwp`, `xboxone`.
- **`runtime` worker:** `ListInstalled`, `Info`, `Install`, `List`, `Verify`, `FetchLicense`.

Verified with runtime 2026.100.0.1133, using the same flags the launcher builds today (`--project --user --runtimePath --runtime=VM --config --verbose --ignorecache --cache --temp --of --tf`). **[experiment]**

- **`windows PackageZip` works** and produced the zip at `--tf`.
- **`windows Run` works:** it compiles, prints `Run_Start`, and launches `<runtime>\Windows\x64\Runner.exe -game …`. Igor's exit code follows the Runner's.
- **Use the exit code for success.** **Counting `Igor complete.` is wrong**: one failed `PackageZip` printed it twice and then exited 1 after an exception.
- **`--tf`'s parent dir must already exist.** Otherwise packaging fails at the last step with `DirectoryNotFoundException`.
- **Igor won't load a project saved in an older format.** It fails with `A type tag field is required…` for the 2022.600 sample. Only the IDE upgrades projects. So a project must be opened and saved in an IDE compatible with the runtime before Igor can build it. `samples/project` needs to be re-saved in a current IDE before it's useful as a fixture.

### How the IDE invokes Igor

Stitch currently passes its own `--cache`/`--temp`/`--of` paths under `<project>/tmp/igor/`. That's a leftover from an Igor version that required them, when we couldn't tell what the IDE passed. The IDE doesn't pass those flags at all. It writes a deprecated "options" file and passes only that **[observed, `ui.log`]**:

```
<runtime>/bin/igor/windows/x64/Igor.exe -j=8 -options="%LOCALAPPDATA%\GameMakerStudio2\GMS2TEMP\build.bff" -v -- Windows Run
```

We captured a `build.bff` during an IDE build **[experiment]**. It's a flat JSON object of strings:

- **Paths:** `projectPath`, `projectDir`, `projectName`, `config`, `runtimeLocation`, `userDir`, `tempFolder`, `outputFolder`, `compile_output_file_name`, `applicationPath` (the IDE's DLL).
- **Prefabs and project tool:** `prefabs`, and `projecttool`, a gmpm package path relative to the IDE.
- **Build settings:** `targetMask` (64 for Windows), `debug`, `verbose`, `useShaders`, plus the debugger and help ports.
- **Pointers to files the IDE generates into its per-project cache:** `macros` (a dump of every expanded macro and .NET special folder), `preferences` (from the user's settings, e.g. the Visual Studio path), `targetOptions` (`{"runtime": "VM"}`) and `steamOptions`.

The IDE's per-project dirs:

- **Cache:** `<AssetCacheFolder>/GMS2CACHE/<first 10 chars of project name>_<hash>/`. Besides the files above, it holds `MainOptions.json`, `PlatformOptions.json`, `ExtensionOptions.json` and per-config folders.
- **Output:** `<TempFolder>/GMS2TEMP/<name>_<another hash>_<VM|YYC>/`.
- **Roots:** the roots are **user preferences** (`machine.General Settings.Paths.IDE.TempFolder` / `AssetCacheFolder` / `IDECacheDirectory` in `local_settings.json`). They default to `%LOCALAPPDATA%\<pdn>` and `%APPDATA%\<pdn>\Cache`, and the IDE appends `GMS2TEMP`/`GMS2CACHE`/`GMS2IDE`.
- **The hashes are deterministic:** the same project got the same name in the Beta and Monthly caches. But they don't match any common hash of the project path (CRC32, FNV, DJB2, MD5/SHA prefixes, Java-style string hash). Users may also enable `DeleteCacheOnQuit`.
- **Login:** the captured build used `userDir` = `unknownUser_unknownUserID`, so local Windows VM builds don't need a logged-in user dir.

**Decision: don't try to share the IDE's caches.** Reproducing them means the unknown hash, user-preference roots, and regenerating several IDE-specific files. Stitch's own flags (`--cache --temp --of …`) already work with current Igor without any of that. **[experiment]** So Stitch gives Igor its own cache; see [Igor cache](#igor-cache).

## Verdicts on current behavior

| Behavior                                           | Verdict                                             | Why                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy releases feed                               | **Replace** with v2 (`@bscotch/gamemaker-releases`) | The legacy feed is frozen, and IDEs missing from it are silently dropped, so every new release is invisible.                                                                                                                                                                                                |
| Find IDEs by scanning `%PROGRAMFILES%`             | **Cut**                                             | Stitch ignores the user's own installs entirely and only uses its own cache.                                                                                                                                                                                                                                |
| IDE version via binary regex                       | **Cut**                                             | Cached IDEs are stored by version (`gamemaker-<ver>/`), so no detection is needed. PE metadata can verify an extraction if wanted.                                                                                                                                                                          |
| Pairing from the feed, else `matching.runtime`     | **Invert**                                          | Use `matching.runtime` for a cached IDE (it's what the IDE will install) and the feed when the IDE isn't cached; a config override wins over both.                                                                                                                                                          |
| `installIde` = silent install, then copy to cache  | **Replace**                                         | Download the installer to the user's Downloads folder, then extract it into the cache with 7-Zip. Stitch never runs installers.                                                                                                                                                                             |
| `ensureOfficialRuntimeFeeds` (on every open)       | **Cut**                                             | The IDE maintains `Master` itself; the extra entries only affect the preferences UI. **[experiment]**                                                                                                                                                                                                       |
| `setActiveRuntime` (writes to every data dir)      | **Cut**                                             | Every IDE resets `active` on boot, and Igor takes `--runtimePath`. It also wrote entries in a different format from the IDE's.                                                                                                                                                                              |
| `disableUpdatePrompt` (fake `updateURI`)           | **Keep, rework**                                    | Without it, a cached older IDE shows "IDE Update Available" on boot **[experiment]**, which confuses users who launched the "right" version through Stitch. With it, the update check fails with a 403. Scope and restore it properly: see [Suppressing the update prompt](#suppressing-the-update-prompt). |
| Install runtimes via Igor (bootstrap runtime)      | **Cut**                                             | Decided earlier: the IDE installs runtimes (license constraints).                                                                                                                                                                                                                                           |
| Delete empty `runtime-*` dirs                      | **Cut**                                             | They may be in-progress downloads, and the dirs belong to GameMaker.                                                                                                                                                                                                                                        |
| User dir from `um.json`                            | **Keep**                                            | The `<login local-part>_<userID>` rule is verified. Allow an override.                                                                                                                                                                                                                                      |
| `GameMakerRunningIde.waitForClose`/`close`         | **Fix**                                             | It's spawned through a shell, _and_ the exe relaunches itself, so it tracks the wrong process.                                                                                                                                                                                                              |
| Igor success = count `Igor complete.`              | **Replace**                                         | Use the exit code.                                                                                                                                                                                                                                                                                          |
| Igor `--cache`/`--temp` under `<project>/tmp/igor` | **Replace**                                         | Move it to a Stitch-owned, self-pruning cache outside the project. Matching the IDE's caches isn't practical (see [How the IDE invokes Igor](#how-the-ide-invokes-igor)).                                                                                                                                   |
| Old `bin/Igor.exe` fallback                        | **Cut**                                             | Not present in any runtime since 2022.                                                                                                                                                                                                                                                                      |

## Bugs found in the current code

- **Runtime `publishedAt` uses the IDE's date.** `GameMakerRuntime.ts:59-61` checks `version.runtime.publishedAt` but uses `version.publishedAt`.
- **Logged output starts with "undefined".** `GameMakerRuntime.command.ts:276-283` initializes `results` as `{}`, so `results[pipe] += …` prefixes `"undefined"`.
- **`disableUpdatePrompt` backs up the wrong state.** It backs up `default_macros.json` only if the backup doesn't exist yet, after the fake URI may already have been written. On this machine every `.bk.json` already contained the fake URI, so the backup can't restore anything. Nothing ever restores it anyway.
- **`GameMakerRunningIde`** (`GameMakerIde.ts:48-75`): `exec` wraps the IDE in a shell, and the IDE relaunches itself, so `close()` and `waitForClose()` act on the wrong process.
- **`installIde`'s copy step** can cache a mixed-version dir (see [Installer](#installer)).
- **The README** shows an outdated `runProject` signature and says Node 16, but the package requires Node 22 or later.

## Design

### Principles

- **Stitch only uses its own IDE cache.** It never runs installers and never looks at or touches the user's own GameMaker installs. Users can keep installing GameMaker normally, alongside Stitch.
- **Compute paths; don't discover them.** GameMaker's system and user dirs come from the channel (which gives `program_dir_name`) plus the OS. Stitch's dirs come from defaults plus overrides. Use filesystem checks only to confirm that something exists.
- **Don't write GameMaker's files**, except the update-prompt override, and only with a real backup and restore.
- **The v2 feed is the source for versions and downloads.** `matching.runtime` is the source for a cached IDE.
- **The launcher is a library.** Machine-specific overrides (cache dir, downloads dir, 7-Zip path) are passed in as options by callers; the VS Code extension reads them from its settings. Per-project settings stay in `stitch.config.json` (`runtimeVersion`) and the `.yyp` (`IDEVersion`).
- **Isolate the platform layer.** One module per OS implements the same small interface. Mac/Linux implementations can start with `NotSupported` errors for any facts we can't confirm.

### Directories

| Dir                        | Default                                                                                                                                                                          | Overridable                                     | Contents                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDE cache                  | `~/.stitch/launcher/ide/`                                                                                                                                                        | Yes. It can grow large: this machine had 10 GB. | `gamemaker-<ver>/`, one clean extracted IDE per version. The layout is unchanged, so existing caches keep working.                                                          |
| Downloads                  | The user's Downloads folder: on Windows the Downloads known folder (it can be relocated), on macOS `~/Downloads`, on Linux `xdg-user-dir DOWNLOAD` falling back to `~/Downloads` | Yes                                             | Official installers, under their original file names. Users can run them separately if they want a regular install. An existing file is reused instead of downloaded again. |
| Igor cache                 | Windows `%LOCALAPPDATA%\stitch\igor`, macOS `~/Library/Caches/stitch/igor`, Linux `${XDG_CACHE_HOME:-~/.cache}/stitch/igor`                                                      | Yes                                             | Per-project Igor `--cache`/`--temp`/`--of` dirs. Self-pruning; see [Igor cache](#igor-cache).                                                                               |
| GameMaker system/user dirs | Computed per channel and OS (see above)                                                                                                                                          | Yes, for unusual setups                         | Runtimes, logins, preferences. These are owned by GameMaker.                                                                                                                |

### Igor cache

- **Why the OS cache location:** it's machine-local (not roaming or synced), outside the project (so nothing to gitignore), and treated by OS cleanup tools as disposable.
- **One entry per project:** `<projectName>-<first 8 hex chars of sha256(normalized absolute .yyp path)>/`. It contains `cache/`, `temp/` and `out/`, plus `stitch-meta.json` holding `{ projectPath, lastUsedAt, runtimeVersion }`. Channels and runtimes don't get separate entries.
- **Bounded per project:** if a run uses a different runtime version than the entry's last run, wipe `cache/`, `temp/` and `out/` first, then record the new version. A different runtime's cache is likely invalid anyway, and this stops entries from accumulating data for every runtime the project has used. (Whether Igor cleans up after itself on a runtime switch wasn't tested; this doesn't depend on it.)
- **Automatic pruning:** each `runIgor` call updates `lastUsedAt`, then removes entries unused for more than 14 days (configurable; 0 disables) and entries whose project file no longer exists. This covers **all** entries, whatever project, channel or runtime last used them. Pruning is cheap: it reads metadata files only, no size calculation. Entries with missing or unreadable metadata (crashes, older formats) are treated as stale.
- **Manual pruning:** `pruneIgorCache(filter?)` and `getIgorCacheInfo()` (entries plus sizes) for UI commands such as "Clear Igor cache". `Clean` commands use the same entry.
- **Packaging output** (`--tf`) still goes where the caller says. The default is the project dir, as today, and its parent dir is created first.
- **Old caches are left alone:** existing `<project>/tmp/igor` dirs are inside users' projects, so they're not deleted automatically. Mention them in the release notes.

### Installing an IDE version

`installIde(ideVersion)`:

1. **Check 7-Zip** (path override, PATH, per-OS locations, then the capability check) before anything else. Fail with install instructions.
2. **Check prerequisites.** On Windows, that's the VC++ runtime. If it's missing, throw an error that explains it and points at the installer in the Downloads folder; the VS Code extension can offer to run it. Running the official installer is then just a regular user install, which also installs VC++, and Stitch's cached copy is unaffected.
3. **Download** the installer from the v2 feed's `downloads[platform]` URL into the Downloads dir, unless it's already there. Verify the size and, on Windows, the Authenticode signature.
4. **Extract** into a temp dir inside the cache, then rename it to `gamemaker-<ver>/` (so a partial extraction never looks installed). Skip the installer's own files (`$PLUGINSDIR`, `$TEMP`). On macOS, take the `.app` from the pkg payload; on Linux, take `/opt/<pkg>/` from the deb.
5. **Verify** that the executable and `matching.runtime` exist.
6. **Make sure the channel's system dir is shared**, matching what the installer does. `installIde` and `openProject` both run this before launching anything, because the IDE creates the dir on first boot otherwise.
   - **Why:** without the installer, the IDE creates the dir owned by the current user, and other users only inherit read and create rights. **[experiment]** Other Windows accounts then can't install runtimes into it.
   - **Windows:** if `C:\ProgramData\<pdn>` doesn't exist, create it and grant Users full control with `icacls "<dir>" /grant *S-1-5-32-545:(OI)(CI)F`. Use the SID because the group name `Users` is localized. As the dir's owner, the user can do this without admin.
   - **If the dir already exists without the grant:** leave it alone. Changing it may need admin. Log a hint instead.
   - **macOS:** the pkg's postinstall `chmod 0777`s `/Users/Shared/<pdn>` and its runtime cache, so do the same when creating them. **[package]**
   - **Linux:** the system dir is under the user's home, so nothing is needed.

The IDE then installs its own runtime the first time it boots.

**Only versions in the v2 feed can be installed.** **[experiment, 2026-11-20]**

- The oldest feed entry in each channel still downloads (HTTP 200): LTS2026 2026.0.0.16, LTS2022 2022.0.0.19, Monthly 2023.8.0.98, Beta 2024.1300.0.743, Unstable 2024.1300.0.740.
- Older versions return **403** from `gms.yoyogames.com`, because GameMaker has removed them. Examples: Betas 2024.400 to 2024.1100, 2023.400.0.324, 2022.600.0.147.

So:

- When an IDE version isn't in the feed and isn't cached, `installIde` fails with a clear error. It suggests updating the project to a supported IDE version, and lists cached and installable versions of the same channel.
- Cached copies of versions that are no longer downloadable are irreplaceable. `pruneIdeCache` (and its UI) must flag them, e.g. "not available for download anymore", and require explicit confirmation before deleting them. `CachedIde` gets an `installable: boolean` from the feed.

### Suppressing the update prompt

Cached IDEs are usually older than the channel's latest, so without suppression they show "IDE Update Available" on every boot. Rework the current hack so it's predictable and reversible:

- **Scope:** apply it only to the system dir of the channel being launched, and only when Stitch launches an IDE. It's on by default for Stitch launches, with a setting to turn it off.
- **Backup:** before writing, record the original state of that `default_macros.json` in Stitch's own state file (in the cache dir): either "absent" or the exact original contents. Don't overwrite an existing record. If the current `updateURI` is already our fake value, keep the existing record.
- **Write:** merge only `updateURI`, keeping the user's other overrides (e.g. `runtimeURI`).
- **Restore** when the launched IDE exits. Because the exe relaunches itself, track the real process by executable path. On every launcher call, also restore any leftover override if no Stitch-launched IDE of that channel is running, which covers crashes. Restore the original `updateURI`, or remove the key, or delete the file if it didn't exist before.
- **Migration:** existing users may have the old fake URI with useless `.bk.json` backups. If the fake URI is found with no Stitch state record, remove the key and delete the `.bk.json` file.
- **Restore early.** The IDE only checks for updates once, at boot: within about 5 s of launch.
  - **Evidence [experiment, IL]:** removing the override while the IDE was running produced no further checks; and the only code that reads `updateURI` is `RuntimeFeedManager.OnIDELoaded`.
  - **So:** restore as soon as `ui.log` shows the check (a `CheckForIDEUpdates` or `update-win…` line after launch), with a timeout fallback of about 60 s. Also restore on exit, plus the crash-recovery check. That way the user's normal install of the same channel goes without update checks for seconds, not a whole session.

### Proposed API

```ts
// Version info (pure, from the v2 feed + overrides)
getIdeVersionDetails(ideVersion, opts?): Promise<{
  ideVersion; channels; channel /* most stable */; publishedAt;
  runtimeVersion /* override > matching.runtime (if on disk) > feed */;
  downloads: Partial<Record<Platform, url>>;
  dirs: { programDirName; system; user; runtimes; userData? /* needs login */ };
}>

// IDEs (Stitch's cache only)
listAvailableIdes(opts?): Promise<CachedIde[]>
findIde(ideVersion, opts?): Promise<CachedIde | undefined>
installIde(ideVersion, opts?: { cacheDir?; downloadsDir?; sevenZipPath?; force? }): Promise<CachedIde>  // download + extract
pruneIdeCache(filter: string[] | ((ide: CachedIde) => boolean), opts?): Promise<string[] /* removed */>
checkPrerequisites(opts?): Promise<{ sevenZip; vcRuntime? /* Windows */ }>  // for UIs to check up front
getInstallerPath(ideVersion, opts?): Promise<string | undefined>  // the downloaded installer, so a UI can offer to run it

// Runtimes (find only; the IDE installs them)
listInstalledRuntimes(opts?): Promise<InstalledRuntime[]>  // across all channels' runtime caches; includes modules from receipt.json
findRuntime(runtimeVersion, opts?): Promise<InstalledRuntime | undefined>

// Open & run
openProject(yypPath, opts?: { ideVersion?; suppressUpdatePrompt? /* default true */ }): Promise<RunningIde>
buildIgorCommand(opts: IgorOptions): { cmd; args }  // pure; replaces compute*/stringify* helpers
runIgor(opts: IgorOptions): Promise<IgorResult>     // exit-code based; ensures output dirs; prunes the Igor cache
pruneIgorCache(filter?, opts?): Promise<string[]>
getIgorCacheInfo(opts?): Promise<IgorCacheEntry[]>

listPaths(opts?): Promise<GameMakerPath[]>  // replaces listWellKnownPaths, keyed by v2 channel
```

`CachedIde` is `{ version, channel, programDirName, directory, executable, pairedRuntimeVersion, sizeBytes? }`. `pruneIdeCache` also removes leftover installer files that old launcher versions left in the cache dir (this machine had two from 2022–2023). It never touches the Downloads folder.

### Consumer coverage

| Call site                                                          | New API                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `parser/src/project.native.ts:362` (IDE dir for help keywords)     | `findIde` / `listAvailableIdes` (falls back as today if nothing is cached) |
| `parser/src/project.native.ts:374` (IDE → runtime version)         | `getIdeVersionDetails().runtimeVersion`                                    |
| `parser/src/project.native.ts:384` (runtime dir for `GmlSpec.xml`) | `findRuntime`                                                              |
| `vscode/src/extension.project.mts:52-68` (find/install/open)       | `findIde`, `installIde`, `openProject`                                     |
| `vscode/src/extension.project.mts:113-185` (run)                   | `getIdeVersionDetails`, `findRuntime`, `buildIgorCommand`                  |
| `vscode/src/extension.locations.mts:46`                            | `listPaths` (drops vscode's duplicate channel regexes)                     |
| `vscode/src/extension.releases.mts:76`                             | `fetchReleasesFeed` from `@bscotch/gamemaker-releases` directly            |

### Removals

- Everything Igor-runtime-install related: `GameMakerLauncher.installRuntime`, `executeGameMakerRuntimeInstallCommand`, and the bootstrap runtime.
- `ensureOfficialRuntimeFeeds`, `setActiveRuntime`, and the empty-dir deletion.
- The legacy feed import and the launcher's own channel enum (`GameMakerFeeds.types.ts`).
- Unused exports: `gameMakerParsedFeedSchema`, `gameMakerFeedOptionsSchema`, `gameMakerFeedDefaultChannels`, `executeGameMakerCleanCommand`, `currentArchitecture`, and the launcher's `GameMakerProject`.
- `samples/feeds/`, plus the stale Igor logs and `tmp/` in `samples/project`.
- `docs/gamemaker-engine.md` was already removed in Phase 1. Its still-valid content is in this file. Skins are out of scope.

### Testing

- **Unit tests, no GameMaker needed:**
  - path computation per OS, with fake env readers
  - 7-Zip discovery and capability parsing
  - update-prompt backup/write/restore state machine, on a temp dir
  - version details, from a fixture v2 feed
  - Igor command building
  - `receipt.json` and `runtime.json` parsing
  - `pruneIdeCache` on a temp dir
- **Integration tests:** opt-in via an env var, against real installs. Replace the current `describe.skip` suite.

### Migration

- Major version bumps for `@bscotch/stitch-launcher`, parser, and vscode.
- vscode's `stitch.gameMaker.releases.notes.channels` setting uses legacy channel names (`stable`), so it must migrate to v2 names (`monthly`, `lts2022`, `lts2026`, …).
- New VS Code settings for the cache dir, downloads dir and 7-Zip path, plus a "Prune cached GameMaker versions" command.
- `stitch.gameMaker.disableGameMakerUpdatePrompt` becomes a default-on setting with new semantics (scoped and auto-restored). On first run, the migration step cleans up the old hack's leftovers.
- The parser and vscode stop seeing the user's own installs. Anything that relied on a Program Files install (e.g. help keywords) must use the cache or fall back.

## Decisions

Made after reviewing the Phase 1 research:

1. **Stitch never runs installers.** It downloads to the Downloads folder and extracts into its own cache with a user-installed 7-Zip. User installs are ignored.
2. **The cache dir is overridable**, and the API only reports cached IDEs (`listAvailableIdes`).
3. **A missing VC++ runtime is an error with instructions.** The UI may offer to run the already-downloaded installer as a normal install.
4. **The update-prompt hack stays**, reworked as above.
5. **Igor uses a Stitch-owned, self-pruning cache** instead of trying to share the IDE's (the IDE's naming and inputs are too convoluted to replicate).

## Implementation notes

Learned while implementing the design (November 2026):

- **Logged-out `um.json` has no `login`/`userID`.** It only has obfuscated keys (`deviceID`, `rocinante`, `lerxst`, …). **[observed]** on the logged-out Beta and LTS2026 dirs; the logged-in Monthly and LTS2022 ones still have `login` and `userID`. So when those fields are missing, the launcher treats the user as logged out and gives Igor `unknownUser_unknownUserID`.
- **What the boot-time update check logs** in `ui.log` **[observed]**: `Download op:1 file url: <updateURI>`, then about a second later `CheckForIDEUpdates Failed: … (403) Forbidden.` when the URI is fake. Either line means the IDE has already read `updateURI`, so the restore watches for both, plus the fake URI itself.
- **Crash recovery is time-based.** A launch counts as pending for 90 s (a 60 s timeout plus margin). The boot check happens within about 5 s, so after that the override can always be restored, whether or not the IDE is still running. That avoids slow process listing on every launcher call.
- **Igor 2026.100.0.1133's usage also lists a `Compile` command** for every build target, besides the changes listed under [Igor](#igor).
- **The v2 feed URL returned 404 on 2026-11-20.** The site hadn't been deployed with it yet. Until it is, anything that needs the feed (installing, or looking up uncached versions) fails with `FEED_UNAVAILABLE`, while cached IDEs keep working.

## Open questions

- **macOS/Linux, on real machines:**
  - Does `GM_RESTART=0` stop the Mac post-install launch?
  - Does the IDE install its runtime on a plain boot, without `--runtime`?
  - Where do `um.json` and the user subdir land on Mac (`~/Library/Application Support` vs `~/.config`)?
  - Is `~/.local/share/<pdn>` the real Linux system dir?
  - Do project paths with spaces work through the Linux wrapper?
  - Does Igor need `chmod +x`, or a quarantine fix on Mac?
  - Is the Mac LTS2026 `program_dir_name` really `GameMakerStudio2-LTS2026`?
  - Does a CLI project open work when an IDE of the same channel is already running?
- **VC++ detection:** is the registry key reliable on machines that only have the runtime from another app's installer?
- **Extracting macOS `.pkg` and Linux `.deb`:** does the result run, and is there quarantine or permission fallout? The research unpacked them with 7-Zip but couldn't run them.

## Experiments

These were run on 2026-11-20. Every GameMaker config file was backed up first and restored afterwards, and the Beta install was restored by re-running the official 2024.1400.3.957 installer.

- **A. Extraction:** 7-Zip extraction of the 1199 installer into a scratch dir, then launching it with a 2022.600 project.
  - It booted normally (logged in) and installed runtime 1133.
  - It offered to upgrade the project.
  - It rewrote `runtime.json` (`active` set to 1133, list pruned).
- **B. Silent install:**
  - `/S /D=C:\GMLauncherTest\GameMaker-Beta` installed 1199 there (38 s) and updated `Install_Dir` and the uninstall key. Program Files' 957 was left in place.
  - Then 904 with `/S` only went to the remembered dir, on top of 1199, leaving 748 stale files.
- **C. Config effects:**
  - Boot with `runtime_feeds.json` set to `[]`, runtime 1133 deleted, and `active` set to 933: the IDE recreated `Master`, reinstalled 1133, and reset `active`.
  - Booting the cached 904 set `active` to 892.
  - With `updateURI` removed, 904 queried `update-win-NuBeta.rss` and showed "IDE Update Available 2026.100.0.1199".
- **D. Igor** with runtime 1133:
  - The 2022.600 sample failed to load (format).
  - A 2024.200 project built with `PackageZip`, once `--tf`'s directory existed, and ran with `Run`.
- **E. `build.bff` capture:** the extracted 1199 IDE ran a scratch project. `build.bff` was copied from `GMS2TEMP` during the build, and its contents are summarized under [How the IDE invokes Igor](#how-the-ide-invokes-igor).
- **F. Update-check timing:**
  - In the same session, the boot check happened about 5 s after launch.
  - After removing `updateURI` while the IDE was running, no further update requests appeared over the rest of the session.
- **G. Clean-slate LTS2026:** extracted 2026.1.0.27 on a machine with no LTS2026 traces (no dirs, no registry), then booted it with no installer run.
  - It created its system, user and local dirs.
  - It installed runtime 2026.1.0.28 as `unknownUser` within 26 s, and wrote `runtime.json` and `runtime_feeds.json` itself.
  - The ProgramData dir it created has only inherited permissions.
