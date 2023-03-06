# GameMaker Engine

The GameMaker engine consists of two separate components:

1. The GameMaker IDE (manages project files and code)
2. The GameMaker Runtime (uses project files to create runnable game builds)

This document describes how the IDE and Runtime relate to each other, how they are versioned, how they are downloaded/updated locally, and where all of their files end up.

## Channels

GameMaker artifacts are available via three channels:

1. **Stable**. Artifacts from "stable" channels are slow to be released, but are (supposedly) well-tested.
2. **Beta**. The Beta channel is for releases of new features that need some additional community feedback & testing before final release. The Beta channel is updated more frequently than the Stable channel, and can be very far ahead in features.
3. **Edge**. Users can opt into a variant of the **Beta** channel to get access to new artifacts very frequently (roughly daily). These are very unstable artifacts that often contain regressions.

Stable and Beta channels have completely distinct version numbers and local installations, so they can be installed at the same time. Edge channels basically opt you into more-frequent Beta releases, so they cannot be installed separately from Beta.

## File Locations

The main installer installs the IDE and prepares a few file system locations for storing miscellaneous files. Beta and Stable installations follow the same pattern but have different locations.

### IDE Files

> 💡 All of these files are deleted upon uninstall (including when installing a different version). **No other** files are deleted on uninstall (the User Files and Cache Files are left alone).

All of the binaries, language, default skins, and other files related to the IDE are stored together. When GameMaker is uninstalled (including prior to installing a different version), all of these files are deleted. The location is wherever the user chose to install to, though the defaults are the following:

- **Stable:** `$PROGRAMFILES/GameMaker`
- **Beta:** `$PROGRAMFILES/GameMaker Studio 2-Beta`

**Useful Files**

- `GameMaker.dll` (`GameMaker-Beta.dll` for beta) includes the version string among all of the binary data. It can be fetched out using a regex search. (A few other binary files also contain this string, but no human-readable files do.)
- `GUI/Skins/` includes a folder per built-in skin (only Light and Dark at the time of writing).
- `defaults/default_macros.json`: GameMaker config files include many references to variables ("macros") that can be overridden in a cascading manner. This file is the initial source of values for many of those variables.

### Cache Files

The IDE does the work of downloading runtimes, and also computes lots of per-project and general information that it needs to cache. All of this ends up together in one place.

- **Stable:** `$PROGRAMDATA/GameMakerStudio2`
- **Beta:** `$PROGRAMDATA/GameMakerStudio2-Beta`

**Useful Files**

- `runtime_feeds.json`: A list of the RSS feeds describing the runtime releases. The contents can be changed to point to other feeds.
- `default_macros.json`: This file can be manually edited to change the default RSS feeds for both the runtime and the IDE. It is not created automatically. It overrides the values originally set by the IDE installation.
- `runtime.json`: This file informs GameMaker which runtime is currently "active", and also provides paths to other installed runtimes keyed by version (note that it's an incomplete list!).
- `ui.log`: When the IDE runs, it dumps log data into this file. When submitting bug tickets to GameMaker, they request this file.
- `Cache/runtimes/`: This is where all of the runtimes are stored, in folders named `runtime-${version}/`.
- `Cache/runtimes/runtime-${version}/bin/Igor.exe`: This is the GameMaker CLI tool. It can be used to install other Runtime versions, as well as to run or build a project.
- `skin.json`: This file appears if the user changes from the default GameMaker IDE Skin. Example content: `{"skin" : "${skin_path}/Light"}`

### User Files

When the user logs in, their credentials must be stored somewhere. GameMaker only allows logging in with one user at a time, but caches information about other users that have logged in.

**Stable:** `$APPDATA/GameMakerStudio2`
**Beta:** `$APPDATA/GameMakerStudio2-Beta`

**Useful Files**

- `um.json` provides information for the _current_ user, including tokens, device IDs, etc. The `username` and `userID` fields map onto the next filename
- `${username}_${userID}/` stores all of the per-user information, including full license information and a cache.
- `${username}_${userID}/local_settings.json`: Editor settings, such as fonts and colors. Note that some fields are not read by the IDE. For example, the `"machine.General Settings.Skin"` field is _written_ by the IDE when the skin is changed via the IDE, but if the field is changed externally GameMaker does not know about it. It writes to the Cache `skin.json` file on change, and _that_ file is read by the IDE.

## Versioning

The GameMaker IDE and Runtimes are versioned separately. In general, a given IDE version is compatible with multiple runtime versions, and vice versa. Compatibility is not predictable, however, and must be determined by testing a given pair in the context of a GameMaker project.

Starting in 2022, GameMaker shifted their versioning approach to use the following patterns:

- Version strings consisting of 4, `.`-separated integers.
- The first integer is the current year (e.g. `2022`).
- The second integer is an integer representing the month. If it is a Beta/Edge version, then this number has two zeroes after it.

## Availability of Artifacts

We have found numerous cases where a Runtime version that used to be available in a feed at some point became unavailable, though this might be restricted to the bleeding edge channel.

Stitch Launcher is a lower-level tool, so its job is to ensure that either it successfully opens the IDE with a given IDE and Runtime version, or that it fails completely. Higher-level tools will have to handle the logic of invalid versions etc.

## Native Installation

> 💡 Users can choose where to install the main GameMaker program, so we can automatically check the default location but will need to be able to allow the user to specify a location.

1. Log into your account and [download the main and/or beta installers](https://accounts.yoyogames.com/dashboard). Installers currently have names formatted like `GameMaker-Installer-2022.600.0.143.exe` (only the version number hints whether the installer is for a beta or non-beta version).
2. Run in the installer.
3. Choose where to install the main program.
4. On bootup, the IDE will fetch and install a runtime.

This process can be automated by passing the `/S` flag to the installer. This spawns a process without waiting for it to complete -- to wait for the process use `cmd` and prefix the installer call with `start /wait`.

## IDE Skins (Themes)

GameMaker comes with built-in "skins", which by default are "Light" and "Dark". It does not have a user-friendly mechanism for creating skins, implying that they aren't really intending users to do that, so we should assume that the IDE's behaviors related to Skins are unstable and subject to change without warning.

The following describes our understanding of how GameMaker Skins are handled, as of version `2022.800.x.y`.

- From the IDE, the user can go to `File > Preferences > General Settings` where they will find a dropdown for "IDE Skin".
- The IDE looks in the `{IDE Files}/GUI/Skins/` and in `{Cache Files}/Skins/` for skins.
  - _🤔 It appears to merge the two. There are some community reports that some versions of GameMaker only look in `{IDE Files}/GUI/Skins/`._
  - _🤔 It's unclear if `{IDE Files}/GUI/Skins/` is the based on the location of the actual IDE executable, or based on the normal installation path. Evidence so far suggests the former._
- When the user changes the skin via the IDE, GameMaker writes record of this fact to:
  - `{Cache Files}/skin.json#/skin`
  - `{User Files}/{username}_{userID}/local_settings.json#/machine.General Settings.Skin`
- Only changing the `{Cache Files}/skin.json#/skin` record causes GameMaker to use a different skin (the other field is write-only), so this is the target for external tooling.
- When GameMaker writes records of skins, it uses the macro `skin_path`, e.g. `{skin_path}/Light`. This entire record can be set to an absolute path, allowing skins to be stored and managed somewhere else when using external tooling.
- There is apparently no mechanism to change GameMaker's default `skin_path` setting.

### Community Pain Points for Skins

_Thanks to users in the GameMaker Kitchen Discord server for the following input. In particular, `gleeson#4282`, `TabularElf#0001`, and `Julien#2376`. The bullets are verbatim from community members._

- biggest pain-points is that you have to download/install them manually, and skins can easily become broken by new IDE updates.

- Skins are typically installed in C:/ProgramData, whereas the default skins are located in C:/Program Files/ along with the rest of the main IDE stuff. I have seen reported behaviour where sometimes the IDE wouldn't recognise this /ProgramData/ location if, say, you bought GMS through Steam or something like that. The issue though is finding the folder that does get recognised by the IDE might mean that the skin folder could get wiped every time you update; you'd have to reinstall the skin each time.

- There's a whole lot of reasons why there haven't been that many GameMaker Skins launched by community members. I can speak from experience that they're a pain in the arse to make, and using the Default Dark skin as reference is... painful. They include a bunch of unused assets that make it difficult to parse what is being used at all. e.g. I haven't been able to edit the default 'folder' icons in the Asset Browser despite there being a bunch of 'folder icons' that... don't look the same. Seemingly this folder icon doesn't actually appear in the skin and cannot be edited? I don't know.
