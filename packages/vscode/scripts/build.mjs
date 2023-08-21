import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import { config } from 'dotenv';
import esbuild from 'esbuild';
import { $ } from 'zx';

config();

// CREATE THE BUNDLE
/** @type {any[]} */
const plugins = [];

if (process.env.SENTRY_AUTH_TOKEN) {
  // Sentry plugin should be LAST!
  plugins.push(
    sentryEsbuildPlugin({
      org: 'bscotch',
      project: 'stitch-vscode',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  );
}

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
  },
  inject: ['./scripts/injection.js'],
  define: {
    'import.meta.url': 'import_meta_url',
    STITCH_VERSION: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    STITCH_ENVIRONMENT: JSON.stringify(
      process.env.SENTRY_AUTH_TOKEN ? 'production' : 'development',
    ),
    SENTRY_DSN: JSON.stringify(process.env.SENTRY_DSN || ''),
  },
  plugins,
});

// Copy the template project from current stitch-core
await $`rm -rf ./assets/templates`;
await $`mkdir -p ./assets/templates`;
await $`cp -r ../parser/assets/GmlSpec.xml ./assets/`;

// Update the icon theme file
await import('./sync-icons.mjs');
