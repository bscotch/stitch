# Design Notes

How GameMaker IDE and Runtime installs work, as far as the launcher is concerned, and why the launcher works the way it does.

Details are based on experiments and analysis done in November 2026 on Windows 11, using GameMaker IDE versions Beta 2026.100.0.1199 (runtime 2026.100.0.1133), Beta 2024.1400.0.904 and LTS2026 2026.1.0.27. GameMaker changes things without notice, so whether or not these results will stay true is anyone's guess!

Each claim is marked with how it was established:

- **[observed]**: seen on disk, in the registry, or in `ui.log`.
- **[experiment]**: from a controlled test, described in [Experiments](#experiments).
- **[package]**: from unpacking GameMaker's installers or runtime modules, without running them.
- **[IL]**: from disassembled IDE code (`Utils.dll`, `IDE.dll`, `OSCore.dll`).
- **[unverified]**: inferred or reported, not confirmed.

## How GameMaker decides where things go

Each channel's IDE has its own name compiled into its "branding" assembly, `GameMaker[-<Channel>].dll`. That name is the `program_dir_name` macro: `GameMakerStudio2`, `GameMakerStudio2-Beta`, `GameMakerStudio2-LTS` or `GameMakerStudio2-LTS2026`. **[observed]**: it's a UTF-16 string in each branding DLL, including copies outside the install dir.

The IDE's own `defaults/default_macros.json` derives every working directory from that name. The paths come from .NET special folders:

| Macro                    | Definition                                     | Windows value                                               |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------- |
| `system_directory`       | `${CommonApplicationData}/${program_dir_name}` | `C:\ProgramData\GameMakerStudio2-Beta`                      |
| `system_cache_directory` | `${system_directory}/Cache`                    | `C:\ProgramData\GameMakerStudio2-Beta\Cache`                |
| `local_directory`        | `${ApplicationData}/${program_dir_name}`       | `%APPDATA%\GameMakerStudio2-Beta`                           |
| `temp_directory`         | `${TempPath}/${program_dir_name}`              | (observed: `%LOCALAPPDATA%\GameMakerStudio2-Beta\GMS2TEMP`) |
| `my_projects_directory`  | `${UserProfile}/GameMakerProjects`             | `%USERPROFILE%\GameMakerProjects`                           |

`<system_directory>/default_macros.json` is merged over these defaults, if it exists. Users and tools use it to override `updateURI` (the IDE update feed) and `runtimeURI` (the runtime feed).

Consequences:

- **Where the IDE runs from doesn't matter.** A copy of a Beta IDE anywhere on disk uses the Beta system and user dirs. **[experiment]** An extracted 1199 and a copied 904 both used `GameMakerStudio2-Beta`. So every copy of a channel's IDE shares one runtime cache, one login, and one set of preferences.
- **Every directory can be computed** from `program_dir_name` plus the OS's meaning of the .NET special folders. Nothing needs to be discovered.
- The releases feed's `channels[].userDirSuffix` is the suffix on `program_dir_name`. It applies to the system dir as well as the user dir. Beta and Unstable share `-Beta`.

## Windows layout

| Channel            | Exe / branding DLL                          | Default install dir                                   | `program_dir_name`                        |
| ------------------ | ------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| `monthly`          | `GameMaker.exe/.dll`                        | `C:\Program Files\GameMaker`                          | `GameMakerStudio2`                        |
| `beta`, `unstable` | `GameMaker-Beta.exe/.dll`                   | `C:\Program Files\GameMaker-Beta`                     | `GameMakerStudio2-Beta`                   |
| `lts2022`          | `GameMaker-LTS.exe/.dll`                    | `C:\Program Files\GameMaker-LTS`                      | `GameMakerStudio2-LTS`                    |
| `lts2026`          | `GameMaker-LTS2026.exe/.dll` **[observed]** | **[unverified]** `C:\Program Files\GameMaker-LTS2026` | `GameMakerStudio2-LTS2026` **[observed]** |

Older installs used other dir names, e.g. `GameMaker Studio 2-Beta`, and older exes were named `GameMakerStudio[2][-<Ch>].exe`. The real install location is in the registry ([Installer](#the-official-installer)), not at a fixed path.

### IDE install dir

| Path                              | Notes                                                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameMaker[-<Ch>].exe`            | A launcher stub. **It relaunches itself:** the PID you spawn exits within seconds and a new process running the same exe becomes the real IDE. **[experiment]** |
| `GameMaker[-<Ch>].dll`, `IDE.dll` | Their PE version metadata (`FileVersion`/`ProductVersion`), and the `.exe`'s, is the IDE version. **[observed]**                                                |
| `matching.runtime`                | The paired runtime version, plain text with a trailing space. It's in the installer payload, so it exists before the first boot. **[observed]**                 |
| `defaults/default_macros.json`    | The macro table described above.                                                                                                                                |
| `RoboHelp/helpdocs_keywords.json` | Keywords for the help docs (used by the parser for help links).                                                                                                 |
| `uninstall.exe`                   | Created by the installer, and **not** in the payload.                                                                                                           |

### System dir (`C:\ProgramData\<program_dir_name>`)

| Path                                                  | Notes                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime.json`                                        | **Owned by the IDE.** Format: `{"active": "<ver>", "<ver>": "<dir>&<feedUrl>"}`. On every boot the IDE sets `active` to its paired runtime and prunes the list. **[experiment]** Entries without `&…` were written by old Stitch versions. Entries can point into _another_ channel's runtime cache. |
| `runtime_feeds.json`                                  | `[{Key, Value}]`. On boot the IDE makes sure `Master` equals the effective `runtimeURI`, recreating the file if it's empty. **[experiment]** Any other entries only add choices in the IDE's Runtime Feeds preferences.                                                                              |
| `default_macros.json`                                 | User/tool overrides of the IDE's macros. The IDE never creates it.                                                                                                                                                                                                                                   |
| `ui.log` (+ rotated `ui-*.gz`)                        | The IDE log. It records the command-line args, runtime installs, and update checks.                                                                                                                                                                                                                  |
| `Cache/runtimes/runtime-<ver>/`                       | Installed runtimes (details below).                                                                                                                                                                                                                                                                  |
| `Skins/`, `Themes/`, `Dumps/`, `Prefabs/`, `Plugins/` | Not relevant to the launcher.                                                                                                                                                                                                                                                                        |

When the official installer creates this dir, it adds an explicit `BUILTIN\Users` FullControl grant. When the IDE creates it instead (on first boot, if no installer ran), it only has inherited permissions: other Windows users can read and create files there, but not modify the runtime cache. **[observed, experiment G]**

### Runtime dir (`Cache/runtimes/runtime-<ver>/`)

| Path                            | Notes                                                                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin/igor/windows/x64/Igor.exe` | The only Igor location in any runtime on this machine, 2022.0 through 2026.100. **[observed]** Older runtimes had `bin/Igor.exe`.                                                         |
| `receipt.json`                  | The installed modules (`base`, `base-module-windows-x64`, `windows`, `windowsYYC`, `operagx`, …), each with its source zip URI and version. This tells which targets a runtime can build. |
| `Windows/x64/Runner.exe`        | The VM runner that `Run` launches.                                                                                                                                                        |
| `GmlSpec.xml`                   | The GML function and constant spec (used by the parser).                                                                                                                                  |
| `BaseProject/`                  | Now only `options/`; there's no template `.yyp` anymore.                                                                                                                                  |

Incomplete runtime dirs exist, e.g. one containing only `download/`, or one with module folders but no Igor. **[observed]** They may be downloads in progress, so a runtime only counts as installed if both Igor and `receipt.json` exist, and these dirs are never deleted.

### User dir (`%APPDATA%\<program_dir_name>`)

| Path                         | Notes                                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `um.json`                    | The current login. The user subdir name is `<login before '@'>_<userID>`. **[observed]** `username` doesn't match. It also contains tokens: never log or copy it. |
| `<login>_<userID>/`          | Per-user data.                                                                                                                                                    |
| `…/licence.plist`            | Used by Igor (the default for `--lf`).                                                                                                                            |
| `…/devices.json`             | Used by Igor (the default for `--df`).                                                                                                                            |
| `…/local_settings.json`      | Preferences. Includes `machine.Runtime Feeds.Saved Modules Selection` (e.g. `base;windows;windowsYYC`), which controls which modules the IDE downloads.           |
| `unknownUser_unknownUserID/` | Used while logged out.                                                                                                                                            |

**A logged-out `um.json` has no `login` or `userID`.** It only has obfuscated keys (`deviceID`, `rocinante`, `lerxst`, …). **[observed]** on the logged-out Beta and LTS2026 dirs; the logged-in Monthly and LTS2022 ones still have `login` and `userID`.

### Elsewhere

- **Registry**, all under **HKCU** even though the installer runs elevated:
  - `HKCU\SOFTWARE\GameMakerStudio2<suffix>` has `Install_Dir`, the remembered install location, and `Installer Language`.
  - `HKCU\…\Uninstall\GameMakerStudio2<suffix>` has `DisplayVersion` (the installed IDE version) and `UninstallString`. `InstallLocation` is empty.
- **Start Menu:** `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\GameMaker[-<Ch>]\`
- **gmpm packages:** `%USERPROFILE%\gmpm[-beta]\`. GameMaker's package manager uses it for IDE tool packages such as `@gm-tools/project-tool-win-x64`. New IDEs create it.
- **Temp:** `%LOCALAPPDATA%\<program_dir_name>\GMS2TEMP`, deleted when the IDE exits.

## macOS and Linux

Nothing here was tested on a real Mac or Linux machine. The facts come from unpacking the 2026.100.0.1199 `.pkg`/`.deb`, the LTS2026 2026.1.0.27 `.deb`, the 1133 runtime module zips, and package metadata for other channels **[package]**, plus disassembled IDE code **[IL]**. The launcher implements its macOS and Linux support from these facts, and marks each unconfirmed one with `TODO(verify)` in the source.

The macro scheme is the same as on Windows: `default_macros.json` is byte-identical, and `program_dir_name` is in the branding `GameMaker.dll`. What differs per OS is the special folders:

| Macro source            | macOS                                                                                          | Linux                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `CommonApplicationData` | Hardcoded `/Users/Shared` **[IL]**                                                             | Set to `LocalApplicationData` = `$XDG_DATA_HOME` or `~/.local/share` **[IL]** |
| `ApplicationData`       | `~/Library/Application Support` (.NET 8). The IDE migrates `~/.config/<pdn>` into it. **[IL]** | `$XDG_CONFIG_HOME` or `~/.config` (.NET)                                      |
| `TempPath`              | `/tmp` **[IL]**                                                                                | `/tmp` **[IL]**                                                               |

| Fact                | macOS                                                                                                                                                                                                                                                                                            | Linux                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channels available  | All                                                                                                                                                                                                                                                                                              | Only `beta`/`unstable` and `lts2026`                                                                                                                                                                      |
| Install             | `sudo installer -pkg X.pkg -target /`. Installs to `/Applications` only (`relocatable="false"`, needs root). Postinstall **launches the IDE** as the console user with `--runtime <ver>`, unless a `gm_install_vars.sh` with `GM_RESTART=0` sits next to the pkg **[package; skip unverified]**. | `sudo apt install ./X.deb`. Installs to `/opt/<pkg>/` plus a `.desktop` file and MIME types. Postinst only loads an AppArmor profile. **[package]**                                                       |
| App / package names | Monthly `GameMaker.app` (`com.yoyogames.gms2`); Beta and Unstable `GameMaker Beta.app` (`com.yoyogames.gms2-beta`); LTS2022 `GameMaker LTS.app` (`com.yoyogames.gm-lts`); LTS2026 `GameMaker LTS 2026.app` (`com.yoyogames.gm-lts2026`) **[package]**                                            | `GameMaker-Beta`, `GameMaker-LTS2026` (installed under `/opt/GameMaker-Beta` and `/opt/GameMaker-LTS2026`) **[package]**                                                                                  |
| Pkg file names      | `GameMaker-<ver>.pkg` for **every** channel; only the version (and the package ID inside) tells them apart                                                                                                                                                                                       | Channel in the name                                                                                                                                                                                       |
| Executable          | `Contents/MacOS/GameMaker`, a universal launcher that spawns `Contents/MacOS/{arm64,x86_64}/GameMaker` as a child process                                                                                                                                                                        | `/opt/<pkg>/GameMaker`, a bash wrapper that `cd`s into `{x86_64,aarch64}/` and runs `./GameMaker ${@:1}`. **The arguments are unquoted**, so paths with spaces break, and the `cd` breaks relative paths. |
| Installed version   | `Contents/Info.plist` `CFBundleShortVersionString`, or `pkgutil --pkg-info <id>`                                                                                                                                                                                                                 | `dpkg-query -W -f='${Version}' <pkg>`, or the PE version of `<arch>/GameMaker.dll`                                                                                                                        |
| `matching.runtime`  | `Contents/MacOS/<arch>/matching.runtime`                                                                                                                                                                                                                                                         | `/opt/<pkg>/<arch>/matching.runtime`                                                                                                                                                                      |
| System dir (Beta)   | `/Users/Shared/GameMakerStudio2-Beta`                                                                                                                                                                                                                                                            | `~/.local/share/GameMakerStudio2-Beta`                                                                                                                                                                    |
| User dir (Beta)     | `~/Library/Application Support/GameMakerStudio2-Beta` (possibly `~/.config/…` on older IDEs)                                                                                                                                                                                                     | `~/.config/GameMakerStudio2-Beta`                                                                                                                                                                         |
| Igor                | `<runtime>/bin/igor/osx/{arm64,x64}/Igor` **[package]**                                                                                                                                                                                                                                          | `<runtime>/bin/igor/linux/{x64,arm64}/Igor` **[package]**                                                                                                                                                 |
| Coexistence         | One version per channel. Unstable overwrites Beta.                                                                                                                                                                                                                                               | Same                                                                                                                                                                                                      |
| Open a project      | `open -a "<app>" /abs/proj.yyp`, or run the launcher with the path. The plumbing is there; the behavior is unverified.                                                                                                                                                                           | `<arch>/GameMaker /abs/proj.yyp` (unverified)                                                                                                                                                             |

How these facts shape the launcher's macOS and Linux support:

- **Cached copies keep the installed shape.** On macOS a cached version holds the `.app` bundle taken from the pkg payload; on Linux it holds the `/opt/<pkg>/` dir taken from the deb. The `.app` name or `<pkg>` name is how the channel (and so `program_dir_name`) is recognized later: `GameMaker LTS 2026.app` and `GameMaker-LTS2026` both mean `-LTS2026`.
- **Extraction is multi-step.** A pkg is a Xar archive containing a `Payload` (a compressed cpio stream); a deb is an Ar archive containing `data.tar.*`. 7-Zip can unpack each layer. Whether the results run (exec bits, symlinks, Gatekeeper and quarantine, and zstd-compressed `data.tar` support in the user's 7-Zip) is untested.
- **On Linux, run `<arch>/GameMaker` directly** with that dir as the working dir, to avoid the wrapper's quoting and `cd` problems.
- **On macOS, the IDE process is a child of the launcher stub**, so the IDE's processes are recognized by path prefix within `Contents/MacOS/`, not by one exact executable.
- **On macOS, the system dir is world-writable.** The pkg's postinstall `chmod 0777`s `/Users/Shared/<pdn>` and its runtime cache **[package]**, so the launcher does the same when it creates them. On Linux the system dir is under the user's home, so nothing is needed.
- **Don't derive dir names from the Mac installer scripts.** They `chmod` `/Users/Shared/GameMaker-LTS*`, which doesn't match the IDE's `GameMakerStudio2-LTS*`.
- **Pkg signatures aren't checked yet**; that needs a Mac to test against.

## The official installer

The Windows installer is **NSIS 3.11**, signed by YoYo Games Ltd, and requires admin. **[observed]** 7-Zip can't decompile its script (`BadCmd=13`), so any custom switches are unknown.

- **Switches:** `/S` (silent) and `/D=<dir>`. `/D=` must be the **last** argument and **unquoted**; spaces are fine. **[experiment]**
- **Exit code:** 0 on success. When started with `Start-Process -Wait`, it blocks until the install finishes (38 s for 1199).
- **Remembered location:** without `/D=`, it installs to `HKCU\SOFTWARE\GameMakerStudio2<suffix>\Install_Dir`, i.e. wherever that channel was last installed. **[experiment]**
- **Installing to a different dir** updates the registry and leaves the previous install untouched, so it's orphaned but still works. **[experiment]**
- **Installing to the same dir overlays files.** It doesn't clean the dir first: after installing 904 over 1199, 748 of the 749 files unique to 1199 were still there. **[experiment]** So a channel's install dir can hold a **mix of versions**. Downgrades are allowed.
- **Prerequisites:** the payload includes VC++ redistributables, which run from `$TEMP`. The IDE refuses to start without them, and the branding DLL contains an error message about this. The runtime is detectable via `HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64`, where `Installed` = 1. **[observed]**
- **Uninstaller:** NSIS uninstallers copy themselves to `%TEMP%` and return immediately. Pass `_?=<install dir>` to run in place and wait.
- **Manual installs** follow the same rules. Users can install any channel anywhere, at any time, which moves `Install_Dir`.

### Extracting the payload instead

`7z x -tNsis <installer> -o<dir> -x!$PLUGINSDIR -x!$TEMP` produces a working IDE dir. **[experiment]**

- It takes about 8 s, needs no admin, and writes nothing to the registry, Program Files, or Start Menu.
- The result is a clean single-version dir that includes `matching.runtime`.
- The extracted 1199 IDE booted normally, logged in, installed its runtime, and opened (offering to upgrade) a project passed on the command line.
- **It needs the _full_ 7-Zip build**: `7z.exe` + `7z.dll` on Windows (verified to work on their own), `7zz` on Mac/Linux. **[experiment]** The standalone `7za` build supports none of the formats needed: NSIS, Xar (`.pkg`), Ar (`.deb`) or Cpio. That's true of both the official 26.06 build and the `7zip-bin` npm package, which also bundles an old 21.07.
- **`7z i` lists the supported formats**, under a `Formats:` heading, so a binary's capability can be checked before relying on it.
- On Windows, 7-Zip records its install dir in the registry: `HKCU`/`HKLM\SOFTWARE\7-Zip`, values `Path64` and `Path`. **[observed]**
- **It skips everything the NSIS script does besides copying files.** Nothing missing was observed, but the script is unreadable. The known steps it skips are:
  - installing the VC++ redistributables
  - `.yyp`/`.yyz` file associations in HKLM (they point to whichever channel was installed last)
  - Start Menu shortcuts
  - the registry `Install_Dir` and the uninstall entry
  - creating `C:\ProgramData\<pdn>` with the explicit `BUILTIN\Users` FullControl grant

## Downloadable versions

Only versions listed in GameMaker's RSS feeds (and so in Stitch's v2 releases feed) can still be downloaded. **[experiment, 2026-11-20]**

- The oldest feed entry in each channel still downloads (HTTP 200): LTS2026 2026.0.0.16, LTS2022 2022.0.0.19, Monthly 2023.8.0.98, Beta 2024.1300.0.743, Unstable 2024.1300.0.740.
- Older versions return **403** from `gms.yoyogames.com`, because GameMaker has removed them. Examples: Betas 2024.400 to 2024.1100, 2023.400.0.324, 2022.600.0.147.

So a cached copy of a version that has dropped out of the feeds can't be replaced.

On 2026-11-20 the v2 feed URL itself returned 404, because the site hadn't been deployed with it yet. Until it is, anything that needs the feed fails, while already-cached IDEs keep working.

## Runtimes are installed by the IDE

On boot, during its `CheckingRSS` loading state, the IDE downloads and installs its `matching.runtime` from the effective `runtimeURI` feed, using the user's saved module selection. Then it sets `runtime.json`'s `active`. **[experiment]**

- This took about 10 s for 1199, and it works for extracted and copied IDEs.
- It also worked with `runtime_feeds.json` emptied and the runtime dir deleted.
- **It doesn't require a login.** On a clean-slate LTS2026 boot it installed the runtime while still `unknownUser`, 26 s after launch. **[experiment G]** With no saved module selection, it installed `base`, `windows` and `operagx`, but not YYC.

Runtimes can also be installed with Igor's `runtime Install` command, but that needs an existing working runtime to run Igor from, and has run into license validation errors and Igor bugs in practice.

## Igor

Igor's `--help` exits with code 127 and prints `unknown option "--help"`, followed by the full usage text. Compared with the text the old launcher's types were generated from, runtime 2026.100.0.1133's usage has:

- **Added:**
  - targets `reddit` and `switch2`
  - a `Compile` command for every target
  - commands `windows PackageZipArm64`, `PackageNsisArm64`, `xboxseriesxs DetermineVSVersion`, `android AndroidRun_Command`
  - per-platform `CleanCode`/`CleanGraphics`/`CleanAudio`, `PreGradleStep`, `PreCleanStep`/`PostCleanStep`
  - options `--launch`, `--nb/--nobuild`, `--pf/--prefabs`, `--pt/--projectool`, `--ssdk`, `--mqtt`
- **Removed:** `winuwp`, `xboxone`.
- **`runtime` worker:** `ListInstalled`, `Info`, `Install`, `List`, `Verify`, `FetchLicense`.

Tested with runtime 1133, using `--project --user --runtimePath --runtime=VM --config --verbose --ignorecache --cache --temp --of --tf`. **[experiment D]**

- **`windows PackageZip` works** and produces the zip at `--tf`.
- **`windows Run` works:** it compiles, prints `Run_Start`, and launches `<runtime>\Windows\x64\Runner.exe -game …`. Igor's exit code follows the Runner's.
- **The exit code is the reliable success signal.** Counting `Igor complete.` lines is not: one failed `PackageZip` printed it twice and then exited 1 after an exception.
- **`--tf`'s parent dir must already exist.** Otherwise packaging fails at the last step with `DirectoryNotFoundException`.
- **`--of` needs a file name**, but only its dir is used.
- **Igor won't load a project saved in an older format.** It fails with `A type tag field is required…` for a 2022.600 project. Only the IDE upgrades projects, so a project must be opened and saved in an IDE compatible with the runtime before Igor can build it.
- **Node's `PATH` breaks MSBuild** when passed through to Igor on Windows ([dotnet/msbuild#5726](https://github.com/dotnet/msbuild/issues/5726)), so it's dropped from Igor's environment.

### How the IDE invokes Igor

The IDE doesn't pass `--cache`, `--temp` or `--of`. It writes a deprecated "options" file and passes only that **[observed, `ui.log`]**:

```
<runtime>/bin/igor/windows/x64/Igor.exe -j=8 -options="%LOCALAPPDATA%\GameMakerStudio2\GMS2TEMP\build.bff" -v -- Windows Run
```

A `build.bff` captured during an IDE build **[experiment E]** is a flat JSON object of strings:

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

## The update prompt

GameMaker checks its channel's IDE feed at boot, and shows "IDE Update Available" when there's a newer version. **[experiment C]**

- **The check happens once, at boot**, about 5 s after launch. **[experiment F]** Removing an override while the IDE was running produced no further checks, and the only code that reads `updateURI` is `RuntimeFeedManager.OnIDELoaded`. **[IL]**
- **A fake `updateURI` on GameMaker's host suppresses the prompt**: the check fails with a 403 and the IDE carries on. **[observed]**
- **What `ui.log` shows** **[observed]**: `Download op:1 file url: <updateURI>`, then about a second later `CheckForIDEUpdates Failed: … (403) Forbidden.` Either line means the IDE has already read `updateURI`.
- **The old launcher's version of this hack** wrote a fake URI into every channel's `default_macros.json` on every launch and never restored it. Its `.bk.json` "backups" were made after the fake URI was written, so on this machine every one contained the fake URI and couldn't restore anything. **[observed]** Users' own GameMaker installs then silently stopped checking for updates.

## Why the launcher works the way it does

### It only uses its own cache of extracted IDEs

The launcher keeps one `gamemaker-<version>` dir per IDE version in its own cache, extracted from the official installer with 7-Zip. It never runs installers, and never looks at or touches the user's own installs.

Alternatives considered:

- **Run the installer silently, then copy the install into a cache** (what the old launcher did). It needs admin, moves the user's remembered install location, and overlays files on the previous install, so the copy can be a mix of versions.
- **Use the user's installs directly.** Users can install any channel anywhere, at any time, and only one version per channel can be installed. The launcher could never assume it knew, or caused, the current state.

Extraction avoids all of that, and the user's normal installs keep working alongside Stitch.

### 7-Zip is a user-installed dependency

The standalone `7za` builds that could be bundled (including the `7zip-bin` npm package) can't extract any of GameMaker's installer formats. Only the full build can, and it's easy to install with each OS's package manager. Since 7-Zip builds differ, the launcher checks the formats a binary reports (`7z i`) before using it, and checks this before downloading anything.

### A missing VC++ runtime is an error with instructions

Extraction skips the installer's VC++ redistributables, and the IDE won't start without them. Installing them separately would mean running an installer, which the launcher doesn't do. Running the official GameMaker installer once as a normal user install installs them, and doesn't affect Stitch's cached copies. Any machine that has ever had GameMaker installed already has them.

### Paths are computed, not discovered

Every GameMaker dir follows from `program_dir_name` and the OS, so the launcher computes them, and only checks the filesystem to confirm that something exists. The old launcher instead scanned `Program Files` and `ProgramData` for anything named like GameMaker, and regex-scanned binary DLLs for version strings. That was slow and broke whenever GameMaker renamed things. A cached IDE's version is its dir name, and its `program_dir_name` comes from its exe (or app or package) name.

### The paired runtime comes from `matching.runtime` first

For a cached IDE, `matching.runtime` is exactly what the IDE will install on boot, so it beats the releases feed's inferred pairing. The feed is used for versions that aren't cached, and a per-project override (`stitch.config.json`'s `runtimeVersion`) beats both.

### The IDE installs runtimes; the launcher only finds them

The IDE reliably installs its paired runtime on boot, even without a login. Installing runtimes with Igor needs a working "bootstrap" runtime and has license and bug problems. So when a needed runtime is missing, the right fix is to open the project in its IDE once.

### GameMaker's own config files are left alone

The IDE rewrites `runtime.json` and `runtime_feeds.json` on every boot **[experiment C]**, so the old launcher's edits to them (setting the active runtime in every channel, adding extra runtime feeds) had no lasting effect, and could surprise users who looked at their preferences. Igor takes the runtime path directly, so nothing needs to be "active". The only GameMaker file the launcher writes is `default_macros.json`, for the update prompt, with a real backup and restore.

### The update prompt is suppressed briefly, per channel

Cached IDEs are usually older than their channel's latest release, so without suppression they'd show "IDE Update Available" on every boot. Users launching via Stitch launcher have already specified the version they want to be running, so that message is confusing and likely to cause people to do the wrong thing. So suppressing is good!

Because the IDE only checks once at boot, the suppression can be short:

- It only changes the system dir of the channel being launched, and only merges `updateURI`, keeping the user's other overrides (like `runtimeURI`).
- It records the file's exact original state (or its absence) in Stitch's own state dir first, and never overwrites that record while the override is in place.
- It restores the original as soon as `ui.log` shows the boot check, with a 60 s fallback and a restore on exit. So the user's own install of that channel goes without update checks for seconds, not a whole session.
- If the file changed in the meantime, it only undoes its own `updateURI` change.
- Several launches of the same channel share one override, which is restored after the last one's check.
- **Crash recovery is time-based.** Any launch older than 90 s is long past its boot check, so the next launcher call can restore its override whether or not that IDE is still running. That avoids listing processes on every call, which takes about a second on Windows.
- Leftovers from the old launcher (the fake URI without a record, and its useless `.bk.json` files) are removed automatically.

### The IDE's processes are tracked by executable path

The IDE's exe relaunches itself, so the PID that gets spawned isn't the IDE's. The launcher records which processes were already running that executable before the launch, and treats new ones that appear in the following seconds as this launch's. The old launcher also ran the IDE through a shell, so it tracked the shell's process instead.

### Igor gets its own self-cleaning cache

Igor needs `--cache`, `--temp` and `--of` dirs. Sharing the IDE's per-project caches would mean reproducing its unknown hash, user-preference roots, and several IDE-generated files. The old launcher put them in `<project>/tmp/igor`, which users had to gitignore, and which grew without limit. Instead:

- They go in the OS's cache dir (machine-local, outside the project, and treated by OS cleanup tools as disposable), one entry per project: `<projectName>-<first 8 hex chars of sha256(normalized .yyp path)>`.
- An entry is wiped when the project is built with a different runtime than last time, since that runtime's cache is likely invalid anyway, and this stops entries from accumulating data for every runtime ever used.
- Entries unused for 14 days, or whose project is gone, are removed whenever Igor runs. That only reads small metadata files, so it's cheap.

### Cached IDEs are only pruned on request

Cached copies of versions that have dropped out of GameMaker's feeds can't be downloaded again, so the launcher never deletes cached IDEs on its own, and requires explicit confirmation before deleting irreplaceable ones.

### Machine-specific settings are options, not inference

The cache dir (which can grow to many GB: this machine had 10 GB), the downloads dir and the 7-Zip path have sensible defaults, and callers can override them. The VS Code extension passes its settings through. Per-project settings stay in the project (`stitch.config.json` and the `.yyp`).

## Open questions

- **macOS/Linux, on real machines:**
  - Does `GM_RESTART=0` stop the Mac post-install launch?
  - Does the IDE install its runtime on a plain boot, without `--runtime`?
  - Where do `um.json` and the user subdir land on Mac (`~/Library/Application Support` vs `~/.config`)?
  - Is `~/.local/share/<pdn>` the real Linux system dir?
  - Does running `<arch>/GameMaker` directly on Linux behave like the wrapper?
  - Does Igor need `chmod +x`, or a quarantine fix on Mac?
  - Is the Mac LTS2026 `program_dir_name` really `GameMakerStudio2-LTS2026`?
  - Do extracted `.app` bundles and `/opt/<pkg>` dirs run, and is there quarantine or permission fallout?
- **Does a CLI project open work when an IDE of the same channel is already running?**
- **VC++ detection:** is the registry key reliable on machines that only have the runtime from another app's installer?

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
  - Booting the copied 904 set `active` to 892.
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
- **H. The launcher's install, end to end:** the launcher's integration test downloaded the 1199 installer (194 MB), verified its YoYo Games Authenticode signature, extracted it with 7-Zip into a temp cache, and found the exe and `matching.runtime`, in 19 s.
- **I. The launcher's open, end to end:** the launcher opened a copy of the sample project in a cached 1199, starting from a Beta `default_macros.json` that still had the old launcher's fake URI.
  - It removed the old leftover (keeping the user's `runtimeURI`) and deleted the `.bk.json`.
  - The IDE requested the new fake URI and got a 403, so no prompt.
  - The original file was restored right after that, and `runtime.json` and `runtime_feeds.json` were unchanged.
  - It found the relaunched IDE process and closed it. The whole test took 35 s.
