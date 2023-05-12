import esbuild from 'esbuild';
import { $ } from 'zx';

// CREATE THE BUNDLE

const builder = esbuild.build({
  entryPoints: ['./src/extension.mts'],
  bundle: true,
  outfile: './dist/extension.mjs',
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
  format: 'esm',
});

// Copy the template project from current stitch-core
await $`rm -rf ./assets/templates`;
await $`mkdir -p ./assets/templates`;
await $`cp -r ../core/assets/issue-template ./assets/templates/`;
await $`cp ./src/index.cjs ./dist/index.cjs`;

// Update the icon theme file
await import('./sync-icons.mjs');
