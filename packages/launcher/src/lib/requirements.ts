/**
 * @file System packages and tools that GameMaker needs but doesn't ship,
 * so that UIs can report what's missing and offer a one-step install.
 *
 * Only Linux has any: the IDE's deb declares package dependencies (which
 * Stitch's cached copies skip, since it never runs installers), and Igor's
 * Linux builds rely on system tools. Sources: the debs' `Depends`, Igor's
 * own commands, GameMaker's "Setting Up For Ubuntu" guide
 * (https://github.com/YoYoGames/GameMaker-Bugs/wiki/Ubuntu-GMS2), and
 * `ldd` on a built game. See NOTES.md.
 */
import { execFile } from './exec.ts';
import { exists } from './fsUtil.ts';
import { resolveOptions, type AnyLauncherOptions } from './options.ts';
import { splitPath } from './platform/posix.ts';

/**
 * What a requirement is needed for:
 * - `ide`: running the IDE itself
 * - `run`: building and running games for Linux with the VM runtime
 * - `yyc`: building games for Linux with the YYC compiler
 */
export type RequirementGroup = 'ide' | 'run' | 'yyc';

interface AptRequirement {
  kind: 'apt';
  /**
   * Package names, any of which satisfies the requirement. Names differ
   * between releases, e.g. Ubuntu 24.04's `t64` packages.
   */
  packages: string[];
}

interface ToolRequirement {
  kind: 'tool';
  /** Executable name to look for on the PATH */
  command: string;
  /** Where the install script puts it */
  installPath: string;
  /** Download URL of the executable (an AppImage) */
  url: string;
  /** The project's home page, for the install script's comments */
  homepage: string;
}

interface DirRequirement {
  kind: 'dir';
  path: string;
  /** URL of a .tar.gz to unpack into `path` */
  url: string;
  /** Approximate download size, for warning users */
  downloadMb: number;
  /** The project's home page, for the install script's comments */
  homepage: string;
}

export type RequirementDefinition = {
  id: string;
  groups: RequirementGroup[];
  description: string;
} & (AptRequirement | ToolRequirement | DirRequirement);

export type SystemRequirement = RequirementDefinition & {
  /** Whether it's present, or `undefined` if that can't be checked */
  installed: boolean | undefined;
  /** For apt requirements: the package name the install script uses */
  installName?: string;
};

export interface SystemRequirementsReport {
  /** The checked requirements, in the requested groups */
  requirements: SystemRequirement[];
  /** Requirements known to be missing */
  missing: SystemRequirement[];
  /**
   * A bash script that installs everything missing (using sudo), when
   * this system's package manager is supported. Undefined if nothing is
   * missing or it can't be generated.
   */
  installScript?: string;
  /** Why some requirements couldn't be checked, if they couldn't */
  note?: string;
}

const steamRuntimeUrl =
  'https://repo.steampowered.com/steamrt-images-scout/snapshots/latest-steam-client-general-availability/com.valvesoftware.SteamRuntime.Sdk-amd64,i386-scout-sysroot.tar.gz';

const apt = (
  id: string,
  groups: RequirementGroup[],
  description: string,
  ...packages: string[]
): RequirementDefinition => ({
  id,
  groups,
  description,
  kind: 'apt',
  packages: packages.length ? packages : [id],
});

/** Everything GameMaker needs on Linux (x64) */
export const linuxRequirements: RequirementDefinition[] = [
  // The IDE deb's `Depends`
  apt('ffmpeg', ['ide'], 'Audio and video conversion in the IDE'),
  apt('zip', ['ide', 'run'], 'Packaging builds'),
  apt('unzip', ['ide', 'run'], 'Unpacking runtimes and builds'),
  apt('libglu1-mesa', ['ide', 'run'], 'OpenGL utilities (GLU)'),
  apt('zenity', ['ide'], 'Native dialogs'),
  // Libraries that built games link against (usually already present on
  // desktop installs)
  apt('libgl1', ['run'], 'OpenGL'),
  apt('libopenal1', ['run'], 'Game audio (OpenAL)'),
  apt('libpulse0', ['run'], 'Game audio (PulseAudio/PipeWire client)'),
  apt(
    'libcurl-gnutls',
    ['run'],
    'Game networking (libcurl)',
    'libcurl3t64-gnutls',
    'libcurl3-gnutls',
  ),
  apt('libxrandr2', ['run'], 'Display modes (XRandR)'),
  apt('libxxf86vm1', ['run'], 'Display modes (XF86VidMode)'),
  // Igor's Linux "Run" builds an AppImage with these, inside the Steam
  // runtime (via chroot)
  {
    id: 'linuxdeploy',
    groups: ['run'],
    description: 'Builds AppImages for Linux runs',
    kind: 'tool',
    command: 'linuxdeploy',
    installPath: '/usr/local/bin/linuxdeploy',
    url: 'https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage',
    homepage: 'https://github.com/linuxdeploy/linuxdeploy',
  },
  {
    id: 'appimagetool',
    groups: ['run'],
    description: 'Builds AppImages for Linux runs',
    kind: 'tool',
    command: 'appimagetool',
    installPath: '/usr/local/bin/appimagetool',
    url: 'https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage',
    homepage: 'https://github.com/AppImage/appimagetool',
  },
  apt('libfuse2', ['run'], 'Running AppImages', 'libfuse2t64', 'libfuse2'),
  {
    // Igor chroots into it; the location is GameMaker's preference
    // "Platform Settings > Linux > steamrt_sdk_dir"
    id: 'steam-runtime',
    groups: ['run', 'yyc'],
    description:
      'The Steam runtime: a standard set of Linux libraries that GameMaker builds Linux games inside, so that they work on most Linux systems (and on Steam)',
    kind: 'dir',
    path: '/opt/steam-runtime',
    url: steamRuntimeUrl,
    downloadMb: 710,
    homepage: 'https://github.com/ValveSoftware/steam-runtime',
  },
  // YYC compiles the game's generated C++ locally
  apt('build-essential', ['yyc'], 'C/C++ build tools'),
  apt('clang', ['yyc'], 'The C++ compiler YYC uses'),
  apt('libssl-dev', ['yyc'], 'YYC: OpenSSL headers'),
  apt('libcurl4-openssl-dev', ['yyc'], 'YYC: libcurl headers'),
  apt('libgl1-mesa-dev', ['yyc'], 'YYC: OpenGL headers'),
  apt('libglu1-mesa-dev', ['yyc'], 'YYC: GLU headers'),
  apt('libopenal-dev', ['yyc'], 'YYC: OpenAL headers'),
  apt('libxrandr-dev', ['yyc'], 'YYC: XRandR headers'),
  apt('libxxf86vm-dev', ['yyc'], 'YYC: XF86VidMode headers'),
  apt('libxfixes-dev', ['yyc'], 'YYC: XFixes headers'),
  apt('zlib1g-dev', ['yyc'], 'YYC: zlib headers'),
  // Deliberately not listed, though GameMaker's guide lists them:
  // `openssh-server` (only for building from another machine's IDE) and
  // `pulseaudio` (it would replace PipeWire's PulseAudio server on modern
  // Ubuntu; games only need the `libpulse0` client).
];

/** How the system is inspected (injectable for tests) */
export interface RequirementProbe {
  /** Installed package names among `names`, or undefined without dpkg */
  installedPackages(names: string[]): Promise<Set<string> | undefined>;
  /** Installable package names among `names`, or undefined without apt */
  availablePackages(names: string[]): Promise<Set<string> | undefined>;
  exists(path: string): Promise<boolean>;
}

/** Parse `dpkg-query -W -f='${Package} ${db:Status-Abbrev}\n'` output */
export function parseDpkgStatus(output: string): Set<string> {
  const installed = new Set<string>();
  for (const line of output.split('\n')) {
    const [name, status] = line.trim().split(/\s+/);
    // "ii" = wanted and installed
    if (name && status?.startsWith('ii')) installed.add(name.split(':')[0]);
  }
  return installed;
}

/** Parse `apt-cache policy <names…>` output into installable names */
export function parseAptPolicy(output: string): Set<string> {
  const available = new Set<string>();
  let current: string | undefined;
  for (const line of output.split('\n')) {
    const header = line.match(/^(\S+):\s*$/);
    if (header) {
      current = header[1].split(':')[0];
      continue;
    }
    const candidate = line.match(/^\s+Candidate:\s*(\S+)/);
    if (current && candidate && candidate[1] !== '(none)') {
      available.add(current);
    }
  }
  return available;
}

const defaultProbe: RequirementProbe = {
  async installedPackages(names) {
    try {
      const result = await execFile(
        'dpkg-query',
        ['-W', '-f=${Package} ${db:Status-Abbrev}\n', ...names],
        { timeoutMs: 15_000 },
      );
      // Exits 1 when some names are unknown, but still lists the rest
      return parseDpkgStatus(result.stdout);
    } catch {
      return undefined;
    }
  },
  async availablePackages(names) {
    try {
      const result = await execFile('apt-cache', ['policy', ...names], {
        timeoutMs: 30_000,
        env: { ...process.env, LC_ALL: 'C' },
      });
      return result.code === 0 ? parseAptPolicy(result.stdout) : undefined;
    } catch {
      return undefined;
    }
  },
  exists,
};

function requirementLabel(r: SystemRequirement) {
  return r.kind === 'apt' ? r.packages[0] : r.id;
}

/** Single-quote a value for bash */
function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * A bash script that installs the given missing requirements. It's shown
 * to users, who may know little about Linux, so it explains each step.
 */
export function buildInstallScript(missing: SystemRequirement[]) {
  if (!missing.length) return;
  const apts = missing.filter((r) => r.kind === 'apt');
  if (apts.some((r) => !r.installName)) return;
  const tools = missing.filter((r) => r.kind === 'tool');
  const dirs = missing.filter((r) => r.kind === 'dir');
  const steps = [apts.length, tools.length, ...dirs.map(() => 1)].filter(
    Boolean,
  ).length;
  let step = 0;
  const announce = (what: string) =>
    `echo; echo "==> Step ${++step} of ${steps}: ${what}"`;

  const lines = [
    '#!/usr/bin/env bash',
    '#',
    "# Installs the software that GameMaker needs on Linux but doesn't",
    '# include itself. Created by Stitch for this computer, listing only',
    "# what's missing.",
    '#',
    '# USE AT YOUR OWN RISK! Stitch does its best to provide only and',
    '# exactly what your system needs, but it cannot guarantee accuracy',
    '# or that the installed dependencies are safe.',
    '#',
    '# - Installing software for the whole computer needs administrator',
    '#   rights, so the commands that start with `sudo` ask for your',
    '#   password. Nothing shows up while you type it (not even dots):',
    "#   that's normal, just type it and press Enter.",
    '#   About sudo: https://www.sudo.ws/about/intro/',
    "# - It's safe to run this again if something goes wrong.",
    "# - GameMaker's own Linux setup guide, which this is based on:",
    '#   https://github.com/YoYoGames/GameMaker-Bugs/wiki/Ubuntu-GMS2',
    '',
    '# Stop at the first error, instead of carrying on as if all is well',
    'set -euo pipefail',
    `trap 'echo; echo "Something went wrong, so not everything was installed. The messages above say what happened. You can run this again to retry."' ERR`,
    '',
  ];

  if (apts.length) {
    lines.push(
      '# System packages, from your Linux distribution (via its "apt"',
      '# package manager, like an app store for the command line):',
      ...apts.map((r) => `#   ${r.installName}: ${r.description}`),
      '# About apt: https://ubuntu.com/server/docs/how-to/software/package-management/',
      announce('installing system packages'),
      '# Refresh the list of available packages and versions',
      'sudo apt-get update',
      '# Install the packages ("-y" answers "yes" to "Do you want to continue?")',
      `sudo apt-get install -y ${apts.map((r) => r.installName).join(' ')}`,
      '',
    );
  }

  if (tools.length || dirs.length) {
    lines.push(
      '# The next steps download files with "curl", so make sure it exists',
      'if ! command -v curl >/dev/null; then',
      '  sudo apt-get update',
      '  sudo apt-get install -y curl',
      'fi',
      '',
    );
  }

  if (tools.length) {
    lines.push(
      "# Tools that aren't in Ubuntu's package list, downloaded from their",
      '# official releases:',
      ...tools.flatMap((r) => [
        `#   ${r.command}: ${r.description}`,
        `#     ${r.homepage}`,
      ]),
      '# Each is downloaded to a temporary folder, then copied into',
      '# /usr/local/bin (where hand-installed programs go) and marked as',
      '# runnable ("-m 0755").',
      announce(`installing ${tools.map((r) => r.command).join(' and ')}`),
      'tmp="$(mktemp -d)"',
    );
    for (const tool of tools) {
      lines.push(
        `curl -fL -o "$tmp/${tool.command}" ${shellQuote(tool.url)}`,
        `sudo install -m 0755 "$tmp/${tool.command}" ${shellQuote(tool.installPath)}`,
      );
    }
    lines.push('rm -rf "$tmp"', '');
  }

  for (const dir of dirs) {
    lines.push(
      `# ${dir.description}.`,
      `#   ${dir.homepage}`,
      `# It's about ${dir.downloadMb} MB to download, so this can take a while.`,
      `# It's unpacked straight into ${dir.path}, where GameMaker looks for it.`,
      announce(`installing ${dir.id} (about ${dir.downloadMb} MB)`),
      `sudo mkdir -p ${shellQuote(dir.path)}`,
      `curl -fL ${shellQuote(dir.url)} | sudo tar -xzf - -C ${shellQuote(dir.path)}`,
      '',
    );
  }

  lines.push(
    'echo',
    'echo "All done! Everything GameMaker needs is now installed."',
    'echo "You can now open GameMaker and run your games, either with Stitch in VS Code or from the GameMaker IDE."',
    'echo "You can close this terminal."',
  );
  return lines.join('\n') + '\n';
}

/**
 * Check which system packages and tools that GameMaker needs are missing.
 * Empty on Windows and macOS (the VC++ runtime is checked separately, see
 * `checkPrerequisites`).
 */
export async function checkSystemRequirements(
  groups: RequirementGroup[] = ['ide', 'run'],
  options?: AnyLauncherOptions,
  probe: RequirementProbe = defaultProbe,
): Promise<SystemRequirementsReport> {
  const opts = resolveOptions(options);
  if (opts.platform.os !== 'linux') return { requirements: [], missing: [] };

  const definitions = linuxRequirements.filter((r) =>
    r.groups.some((g) => groups.includes(g)),
  );
  const packageNames = definitions.flatMap((r) =>
    r.kind === 'apt' ? r.packages : [],
  );
  const [installed, available] = await Promise.all([
    probe.installedPackages(packageNames),
    probe.availablePackages(packageNames),
  ]);
  const pathDirs = [
    ...splitPath(opts.env.env.PATH, ':'),
    // GUI apps may not have it on their PATH
    '/usr/local/bin',
  ];

  const requirements: SystemRequirement[] = await Promise.all(
    definitions.map(async (r): Promise<SystemRequirement> => {
      switch (r.kind) {
        case 'apt':
          return {
            ...r,
            installed: installed && r.packages.some((p) => installed.has(p)),
            installName: available && r.packages.find((p) => available.has(p)),
          };
        case 'tool': {
          let found = false;
          for (const dir of new Set(pathDirs)) {
            if (await probe.exists(`${dir}/${r.command}`)) {
              found = true;
              break;
            }
          }
          return { ...r, installed: found };
        }
        case 'dir':
          return { ...r, installed: await probe.exists(r.path) };
      }
    }),
  );
  const missing = requirements.filter((r) => r.installed === false);
  const unknown = requirements.filter((r) => r.installed === undefined);
  const unresolvable = missing.filter(
    (r) => r.kind === 'apt' && !r.installName,
  );
  const note = unknown.length
    ? `Couldn't check system packages (${unknown.map(requirementLabel).join(', ')}): this doesn't look like a Debian-based distro. GameMaker officially supports only Ubuntu; install the equivalent packages with your package manager.`
    : unresolvable.length
      ? `Couldn't find an installable package for: ${unresolvable.map(requirementLabel).join(', ')}.`
      : undefined;
  return {
    requirements,
    missing,
    installScript: unresolvable.length
      ? undefined
      : buildInstallScript(missing),
    note,
  };
}
