import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkSystemRequirements,
  linuxRequirements,
  parseAptPolicy,
  parseDpkgStatus,
  type RequirementProbe,
} from './requirements.ts';

const allPackages = linuxRequirements.flatMap((r) =>
  r.kind === 'apt' ? r.packages : [],
);

/** An Ubuntu 24.04-like system: `t64` names, old names not installable */
function fakeProbe(opts: {
  installed?: string[];
  files?: string[];
  dpkg?: boolean;
}): RequirementProbe {
  const installable = new Set(
    allPackages.filter((p) => p !== 'libfuse2' && p !== 'libcurl3-gnutls'),
  );
  return {
    installedPackages() {
      return Promise.resolve(
        opts.dpkg === false ? undefined : new Set(opts.installed ?? []),
      );
    },
    availablePackages() {
      return Promise.resolve(opts.dpkg === false ? undefined : installable);
    },
    exists(path) {
      return Promise.resolve((opts.files ?? []).includes(path));
    },
  };
}

const linux = {
  os: 'linux' as const,
  platformEnv: {
    homedir: '/home/u',
    env: { PATH: '/usr/bin:/bin' },
    arch: 'x64',
  },
};

describe('System requirements', function () {
  it('has none on Windows and macOS', async function () {
    for (const os of ['windows', 'mac'] as const) {
      const report = await checkSystemRequirements(
        ['ide', 'run', 'yyc'],
        { os },
        fakeProbe({}),
      );
      assert.deepEqual(report, { requirements: [], missing: [] });
    }
  });

  it('reports nothing missing when everything is installed', async function () {
    const report = await checkSystemRequirements(
      ['ide', 'run', 'yyc'],
      linux,
      fakeProbe({
        installed: ['libfuse2t64', 'libcurl3t64-gnutls', ...allPackages],
        files: [
          '/usr/local/bin/linuxdeploy',
          '/usr/bin/appimagetool',
          '/opt/steam-runtime',
        ],
      }),
    );
    assert.deepEqual(report.missing, []);
    assert.equal(report.installScript, undefined);
    assert.equal(report.note, undefined);
  });

  it('only checks the requested groups', async function () {
    const report = await checkSystemRequirements(['ide'], linux, fakeProbe({}));
    assert.deepEqual(
      report.missing.map((r) => r.id),
      ['ffmpeg', 'zip', 'unzip', 'libglu1-mesa', 'zenity'],
    );
  });

  it("accepts any of a requirement's package names, and installs one that exists", async function () {
    const report = await checkSystemRequirements(
      ['run'],
      linux,
      fakeProbe({ installed: ['libcurl3-gnutls'] }),
    );
    const byId = new Map(report.missing.map((r) => [r.id, r]));
    // Satisfied by the older name
    assert.ok(!byId.has('libcurl-gnutls'));
    // Missing, and only the t64 name is installable
    assert.equal(byId.get('libfuse2')?.installName, 'libfuse2t64');
  });

  it('builds one install script for everything missing', async function () {
    const report = await checkSystemRequirements(
      ['ide', 'run'],
      linux,
      fakeProbe({}),
    );
    const script = report.installScript!;
    assert.match(script, /^#!\/usr\/bin\/env bash\n/);
    assert.match(script, /^set -euo pipefail$/m);
    // Explained for people new to Linux, with a clear ending
    assert.match(script, /^# {3}libfuse2t64: Running AppImages$/m);
    assert.match(script, /Step 3 of 3: installing steam-runtime/);
    assert.match(script, /All done!/);
    assert.match(
      script,
      /sudo apt-get install -y ffmpeg zip unzip libglu1-mesa zenity .*libfuse2t64/,
    );
    assert.match(
      script,
      /sudo install -m 0755 "\$tmp\/linuxdeploy" '\/usr\/local\/bin\/linuxdeploy'/,
    );
    assert.match(script, /sudo tar -xzf - -C '\/opt\/steam-runtime'/);
    assert.doesNotMatch(script, /pulseaudio|openssh-server/);
  });

  it("explains when packages can't be checked (non-Debian distros)", async function () {
    const report = await checkSystemRequirements(
      ['ide'],
      linux,
      fakeProbe({ dpkg: false }),
    );
    assert.equal(report.missing.length, 0);
    assert.ok(report.requirements.every((r) => r.installed === undefined));
    assert.match(report.note!, /Debian-based/);
    assert.equal(report.installScript, undefined);
  });

  it('parses dpkg-query and apt-cache output', function () {
    assert.deepEqual(
      [...parseDpkgStatus('zip ii \nffmpeg un \nlibfuse2t64:amd64 ii \n')],
      ['zip', 'libfuse2t64'],
    );
    const policy = [
      'libfuse2:',
      '  Installed: (none)',
      '  Candidate: (none)',
      '  Version table:',
      'libfuse2t64:',
      '  Installed: 2.9.9-8.1build1',
      '  Candidate: 2.9.9-8.1build1',
      '  Version table:',
      ' *** 2.9.9-8.1build1 500',
      '        500 http://archive.ubuntu.com/ubuntu noble/universe amd64 Packages',
    ].join('\n');
    assert.deepEqual([...parseAptPolicy(policy)], ['libfuse2t64']);
  });
});
