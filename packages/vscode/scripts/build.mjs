import esbuild from 'esbuild';
import { $ } from 'zx';

// CREATE THE BUNDLE

const builder = esbuild.build({
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  outfile: './dist/extension.js',
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
await $`cp -r ../core/assets/issue-template ./assets/templates/`;

// Update the icon theme file
await import('./sync-icons.mjs');
