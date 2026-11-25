import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseLsofExecutable,
  parsePkgSignature,
  yoyoGamesTeamId,
} from './mac.ts';

/** `pkgutil --check-signature` output for the 2026.100.0.1199 pkg */
const signed = `Package "GameMaker-2026.100.0.1199.pkg":
   Status: signed by a developer certificate issued by Apple for distribution
   Notarization: trusted by the Apple notary service
   Signed with a trusted timestamp on: 2026-11-04 16:41:38 +0000
   Certificate Chain:
    1. Developer ID Installer: YoYo Games Ltd (C9E7J7HL3D)
       Expires: 2027-02-01 22:12:15 +0000
       SHA256 Fingerprint:
           DB 3C 71 62 E4 88 1B 90 6E 47 DC 0B B0 F2 FB 7F 9F 88 00 59 EE 4E
           72 0F 63 D4 65 D8 AE 82 82 F8
       ------------------------------------------------------------------------
    2. Developer ID Certification Authority
       Expires: 2027-02-01 22:12:15 +0000
       ------------------------------------------------------------------------
    3. Apple Root CA
       Expires: 2035-02-09 21:40:36 +0000
`;

describe('macOS pkg signatures', function () {
  it('parses a signed, notarized YoYo Games pkg', function () {
    assert.deepEqual(parsePkgSignature(signed), {
      signed: true,
      notarized: true,
      signer: 'Developer ID Installer: YoYo Games Ltd (C9E7J7HL3D)',
      teamId: yoyoGamesTeamId,
    });
  });

  it('parses an unsigned pkg', function () {
    assert.deepEqual(
      parsePkgSignature(`Package "u.pkg":\n   Status: no signature\n`),
      { signed: false, notarized: false, signer: undefined, teamId: undefined },
    );
  });

  it("reports another developer's team ID", function () {
    const other = signed.replace(
      'YoYo Games Ltd (C9E7J7HL3D)',
      'Someone (ABCDE12345)',
    );
    assert.equal(parsePkgSignature(other).teamId, 'ABCDE12345');
  });
});

describe('macOS processes', function () {
  it('reads the executable from lsof output', function () {
    // For an IDE whose `ps` name is just "arm64/GameMaker"
    const output = [
      'p17814',
      'ftxt',
      'n/Applications/GameMaker Beta.app/Contents/MacOS/arm64/GameMaker',
      'ftxt',
      'n/usr/lib/dyld',
      '',
    ].join('\n');
    assert.equal(
      parseLsofExecutable(output),
      '/Applications/GameMaker Beta.app/Contents/MacOS/arm64/GameMaker',
    );
    assert.equal(parseLsofExecutable(''), undefined);
  });
});
