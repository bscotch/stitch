import { Pathy, pathy } from '@bscotch/pathy';
import { config } from 'dotenv';
import esbuild from 'esbuild';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import { $ } from 'zx';

config();

await $`mkdir -p ./dist`;

const builder = esbuild.build({
  entryPoints: ['./src/extension.ts', './src/manifest.update.mts'],
  bundle: true,
  outdir: './dist/',
  target: 'esnext',
  keepNames: true,
  sourcemap: true,
  platform: 'node',
  nodePaths: ['node_modules'],
  external: ['vscode'],
  loader: {
    '.xml': 'text',
    '.html': 'text',
    '.node': 'file',
  },
  inject: ['./scripts/injection.js'],
  define: {
    'import.meta.url': 'import_meta_url',
    STITCH_VERSION: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    STITCH_ENVIRONMENT: JSON.stringify(
      process.env.CI ? 'production' : 'development',
    ),
  },
});

// Copy the template project from current stitch-core
await $`rm -rf ./assets/templates`;
await $`mkdir -p ./assets/templates`;
await $`cp -r ../parser/assets/GmlSpec.xml ./assets/`;

// Copy the pixel-checksum binary from current pixel-checksum,
// if we don't already have the same file. (This is because the
// binary cannot be overwritten when the extension is running in
// the debugger!)
const destPath = pathy('./dist/pixel-checksum.node');
const srcPath = pathy('../pixel-checksum/pixel-checksum.node');
const destChecksum = (await destPath.exists())
  ? await computeFileChecksum(destPath)
  : null;
const srcChecksum = destChecksum ? await computeFileChecksum(srcPath) : null;
if (!srcChecksum || destChecksum !== srcChecksum) {
  await $`cp ../pixel-checksum/pixel-checksum.node ./dist`;
}

// Update the icon theme file
await import('./sync-icons.mjs');

/**
 * Compute the checksum for a target file using node's crypto library
 * @param {Pathy} path
 */
async function computeFileChecksum(path) {
  const hash = crypto.createHash('sha256');
  /** @type {Buffer} */
  const file = await fsp.readFile(path.absolute);
  hash.update(file);
  return hash.digest('hex');
}
