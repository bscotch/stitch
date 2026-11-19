import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareVersions,
  incrementVersion,
  isValidVersion,
  maxBump,
} from './semver.mts';

describe('semver', () => {
  it('validates versions', () => {
    assert.ok(isValidVersion('1.2.3'));
    assert.ok(isValidVersion('0.0.1-beta.2+build.5'));
    assert.ok(!isValidVersion('1.2'));
    assert.ok(!isValidVersion('v1.2.3'));
    assert.ok(!isValidVersion('01.2.3'));
  });

  it('compares versions', () => {
    assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
    assert.equal(compareVersions('1.10.0', '1.9.0'), 1);
    assert.equal(compareVersions('0.9.9', '1.0.0'), -1);
    assert.equal(compareVersions('1.0.0-alpha', '1.0.0'), -1);
    assert.equal(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.10'), -1);
    assert.equal(compareVersions('1.0.0-alpha.1', '1.0.0-beta'), -1);
    assert.equal(compareVersions('1.0.0-alpha', '1.0.0-alpha.1'), -1);
  });

  it('increments versions like semver.inc', () => {
    assert.equal(incrementVersion('1.2.3', 'patch'), '1.2.4');
    assert.equal(incrementVersion('1.2.3', 'minor'), '1.3.0');
    assert.equal(incrementVersion('1.2.3', 'major'), '2.0.0');
    assert.equal(incrementVersion('0.26.0', 'minor'), '0.27.0');
    assert.equal(incrementVersion('0.26.0', 'major'), '1.0.0');
    assert.equal(incrementVersion('1.2.3-beta.1', 'patch'), '1.2.3');
    assert.equal(incrementVersion('1.2.0-beta.1', 'minor'), '1.2.0');
    assert.equal(incrementVersion('2.0.0-beta.1', 'major'), '2.0.0');
  });

  it('finds the max bump', () => {
    assert.equal(maxBump([]), undefined);
    assert.equal(maxBump([undefined, undefined]), undefined);
    assert.equal(maxBump([undefined, 'patch']), 'patch');
    assert.equal(maxBump(['patch', 'major', 'minor']), 'major');
    assert.equal(maxBump(['minor', undefined, 'patch']), 'minor');
  });
});
