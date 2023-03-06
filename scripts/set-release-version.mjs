// Set the RELEASE_VERSION env var to the version of a package

import fs from 'fs/promises';

const packageDir = process.argv[2];

const manifestPath = `${packageDir}/package.json`;

try {
  await fs.stat(manifestPath);
} catch (err) {
  console.error(`No package.json in ${packageDir}`);
  process.exit(1);
}

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

const version = manifest.version;

console.log({
  name: manifest.name,
  version,
});

await fs.appendFile(
  /** @type {string} */
  (process.env.GITHUB_ENV),
  `RELEASE_VERSION=${version}`,
);
