import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { channels } from '@bscotch/gamemaker-releases';
import { LauncherError } from '../errors.ts';
import { execFile, powershell } from '../exec.ts';
import { exists } from '../fsUtil.ts';
import type { IdeLayout, PlatformLayer, RunningProcess } from './types.ts';
import { expandWindowsEnvVars, readRegistryValue } from './windows.registry.ts';

const p = path.win32;

/** SID of the built-in "Users" group (the group name itself is localized) */
const usersSid = 'S-1-5-32-545';

/**
 * Exe names of cached IDEs: `GameMaker[-<Suffix>].exe`. Old IDE installs
 * (and so old Stitch caches) used `GameMakerStudio[2][-<Suffix>].exe`.
 */
const ideExePattern = /^GameMaker(?:Studio2?)?(-[A-Za-z0-9]+)?\.exe$/i;

export const windows: PlatformLayer = {
  os: 'windows',
  feedPlatform: 'windows',
  sevenZipFormat: 'Nsis',
  sevenZipInstallCommand: 'winget install 7zip.7zip',
  sevenZipNames: ['7z.exe'],
  pathDelimiter: ';',
  path: p,

  specialFolders(env) {
    return {
      commonApplicationData: env.env.PROGRAMDATA || 'C:\\ProgramData',
      applicationData:
        env.env.APPDATA || p.join(env.homedir, 'AppData', 'Roaming'),
    };
  },

  defaultIgorCacheDir(env) {
    const local =
      env.env.LOCALAPPDATA || p.join(env.homedir, 'AppData', 'Local');
    return p.join(local, 'stitch', 'igor');
  },

  async defaultDownloadsDir(env) {
    // The Downloads "known folder" can be relocated by the user, so it has
    // to come from the registry.
    const value = await readRegistryValue(
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
      '{374DE290-123F-4565-9164-39C4925E467B}',
    );
    if (value?.value) {
      return expandWindowsEnvVars(value.value, {
        USERPROFILE: env.homedir,
        ...env.env,
      });
    }
    return p.join(env.homedir, 'Downloads');
  },

  igorCandidates(runtimeDir, arch) {
    const x64 = p.join(runtimeDir, 'bin', 'igor', 'windows', 'x64', 'Igor.exe');
    // Only x64 has been observed, in every runtime from 2022.0 to 2026.100.
    return arch === 'arm64'
      ? [p.join(runtimeDir, 'bin', 'igor', 'windows', 'arm64', 'Igor.exe'), x64]
      : [x64];
  },

  async sevenZipCandidates(env) {
    const candidates: string[] = [];
    for (const hive of ['HKCU', 'HKLM']) {
      for (const name of ['Path64', 'Path']) {
        const value = await readRegistryValue(`${hive}\\SOFTWARE\\7-Zip`, name);
        if (value?.value) candidates.push(p.join(value.value, '7z.exe'));
      }
    }
    for (const programFiles of [env.env.ProgramW6432, env.env.ProgramFiles]) {
      if (programFiles)
        candidates.push(p.join(programFiles, '7-Zip', '7z.exe'));
    }
    return candidates;
  },

  async resolveIdeLayout(ideDir): Promise<IdeLayout | undefined> {
    let files: string[];
    try {
      files = await readdir(ideDir);
    } catch {
      return;
    }
    const exe = files
      .map((f) => ({ f, match: f.match(ideExePattern) }))
      .filter((x) => x.match)
      // Prefer the shortest name, e.g. `GameMaker-Beta.exe` over oddities
      .sort((a, b) => a.f.length - b.f.length)[0];
    if (!exe) return;
    const suffix = exe.match![1] || '';
    return {
      programDirName: `GameMakerStudio2${normalizeSuffix(suffix)}`,
      executable: p.join(ideDir, exe.f),
      cwd: ideDir,
      matchingRuntime: p.join(ideDir, 'matching.runtime'),
      helpKeywords: p.join(ideDir, 'RoboHelp', 'helpdocs_keywords.json'),
    };
  },

  async extractInstaller(sevenZip, installer, destDir) {
    // Skip the NSIS installer's own plugins and temp files: the result is
    // exactly the IDE's install dir.
    const result = await execFile(
      sevenZip,
      [
        'x',
        '-tNsis',
        '-y',
        '-bd',
        `-o${destDir}`,
        '-x!$PLUGINSDIR',
        '-x!$TEMP',
        installer,
      ],
      { timeoutMs: 15 * 60_000 },
    );
    if (result.code !== 0) {
      throw new Error(
        `7-Zip exited with code ${result.code}: ${result.stderr || result.stdout}`,
      );
    }
  },

  async verifyInstaller(installer) {
    const result = await powershell(
      `$s = Get-AuthenticodeSignature -LiteralPath $env:STITCH_FILE; ` +
        `[pscustomobject]@{ Status = $s.Status.ToString(); Subject = $s.SignerCertificate.Subject } | ConvertTo-Json -Compress`,
      { STITCH_FILE: installer },
    );
    let info: { Status?: string; Subject?: string } = {};
    try {
      info = JSON.parse(result.stdout);
    } catch {
      // Handled below
    }
    if (info.Status !== 'Valid' || !/YoYo Games/i.test(info.Subject || '')) {
      throw new LauncherError(
        'INSTALLER_INVALID',
        `The GameMaker installer at "${installer}" does not have a valid YoYo Games signature (status: ${info.Status || 'unknown'}, signer: ${info.Subject || 'none'}).`,
        { installerPath: installer },
        { fix: 'Delete the file so that it can be downloaded again.' },
      );
    }
  },

  async checkVcRuntime() {
    // TODO(verify): Is this key reliable on machines that only got the VC++
    // runtime from some other app's installer?
    for (const key of [
      'HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64',
      'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64',
    ]) {
      const value = await readRegistryValue(key, 'Installed');
      if (value && Number(value.value) === 1) return true;
    }
    return false;
  },

  async ensureSystemDir(dir) {
    if (await exists(dir)) {
      const result = await powershell(
        `$sid = New-Object System.Security.Principal.SecurityIdentifier($env:STITCH_SID); ` +
          `$ok = (Get-Acl -LiteralPath $env:STITCH_DIR).Access | Where-Object { ` +
          `try { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]) -eq $sid } catch { $false } ` +
          `} | Where-Object { $_.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl -eq [System.Security.AccessControl.FileSystemRights]::FullControl }; ` +
          `if ($ok) { 'shared' } else { 'private' }`,
        { STITCH_SID: usersSid, STITCH_DIR: dir },
      ).catch(() => undefined);
      return {
        created: false,
        hint:
          result?.stdout.trim() === 'private'
            ? `"${dir}" is not writable by other Windows users, so they won't be able to install GameMaker runtimes. An administrator can fix that with: icacls "${dir}" /grant *${usersSid}:(OI)(CI)F /T`
            : undefined,
      };
    }
    await mkdir(dir, { recursive: true });
    // As the dir's owner, the current user can grant this without admin.
    const result = await execFile(
      'icacls.exe',
      [dir, '/grant', `*${usersSid}:(OI)(CI)F`],
      { timeoutMs: 30_000 },
    );
    return {
      created: true,
      hint:
        result.code === 0
          ? undefined
          : `Created "${dir}", but could not share it with other Windows users: ${result.stdout || result.stderr}`,
    };
  },

  async listProcesses(executable) {
    const result = await powershell(
      `Get-CimInstance Win32_Process -Filter ("Name='" + $env:STITCH_NAME + "'") | ` +
        `ForEach-Object { [pscustomobject]@{ pid = $_.ProcessId; executable = $_.ExecutablePath } } | ConvertTo-Json -Compress`,
      { STITCH_NAME: p.basename(executable).replace(/'/g, "''") },
    );
    const text = result.stdout.trim();
    if (!text) return [];
    let parsed: RunningProcess | RunningProcess[];
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }
    const target = normalizeWindowsPath(executable);
    return (Array.isArray(parsed) ? parsed : [parsed]).filter(
      (proc) =>
        proc.executable && normalizeWindowsPath(proc.executable) === target,
    );
  },

  async killProcess(pid) {
    await execFile('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      timeoutMs: 30_000,
    });
  },
};

function normalizeWindowsPath(path: string) {
  return p.resolve(path).toLowerCase();
}

/**
 * Exe suffixes match `program_dir_name` suffixes, except for case:
 * `GameMaker-Beta.exe` goes with `GameMakerStudio2-Beta`.
 */
function normalizeSuffix(suffix: string) {
  if (!suffix) return '';
  const known = channels.map((c) => c.userDirSuffix as string);
  return known.find((k) => k.toLowerCase() === suffix.toLowerCase()) ?? suffix;
}
