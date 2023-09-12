import { config } from 'dotenv';
import esbuild from 'esbuild';
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
await $`cp ../pixel-checksum/pixel-checksum.node ./dist`;

// Update the icon theme file
await import('./sync-icons.mjs');
