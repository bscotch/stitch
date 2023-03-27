import semver from 'https://esm.sh/semver';

console.log([
  semver.clean('stitch@v2.3.4-rc.0.10'),

  semver.coerce('stitch@2.3.4-rc.0.10', { loose: true })?.version,

  semver.valid('v0.0.1'),
  semver.valid('stitch@v2.3.4'),
]);
