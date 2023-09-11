const test = require('node:test');
const assert = require('node:assert');
const {
  computePngChecksum,
  computePngChecksums,
} = require('./pixel-checksum.node');

test.describe('compute_pixels_checksum', () => {
  test.it('should return the checksum of the pixels', () => {
    const checksum = computePngChecksum('sample.png');
    assert.ok(
      checksum && typeof checksum === 'string' && checksum.length,
      'checksum is not a non-empty string',
    );
  });
  test.it('should return the checksums for an array of images', () => {
    const checksums = computePngChecksums(['sample.png']);
    assert.ok(
      checksums &&
        Array.isArray(checksums) &&
        checksums.length === 1 &&
        typeof checksums[0] === 'string' &&
        checksums[0].length,
      'checksum is not a single-element array of non-empty strings',
    );
  });
});
