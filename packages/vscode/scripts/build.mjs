import esbuild from 'esbuild';
import { $ } from 'zx';

// CREATE THE BUNDLE

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
  },
});

// Copy the template project from current stitch-core
await $`rm -rf ./assets/templates`;
await $`mkdir -p ./assets/templates`;
await $`cp -r ../parser/assets/GmlSpec.xml ./assets/`;

// Update the icon theme file
await import('./sync-icons.mjs');
