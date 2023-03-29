import semver from 'https://esm.sh/semver';

const samples = [
  'v10.0.3',
  '0.0.11',
  '0.0.11-rc',
  'monorepo@v2.3.4-rc.0.10',
  'monorepo2.3',
  '1.2.3-rc',
  'hello world 1',
];

/**
 * @param {string} version_string
 * @returns {string|null}
 */
function find_semver_substring(version_string) {
  if (!version_string || typeof version_string !== 'string') {
    return false;
  }
  let version = semver.valid(version_string);
  if (version) {
    return version;
  }
  // Else grab the first substring that looks like a semver
  // Adapted from https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
  version =
    /(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?/.exec(
      version_string,
    )?.[0];
  return version ?? null;
}

/** @type {Record<
  string,
  { valid: string | null; clean: string | null; coerced: string | null, custom: string|null }
>} */
const summary = {};
for (const sample of samples) {
  summary[sample] = {
    valid: semver.valid(sample),
    clean: semver.clean(sample),
    coerced: semver.coerce(sample)?.version ?? null,
    custom: find_semver_substring(sample),
  };
}

console.log(JSON.stringify(summary, null, 2));
