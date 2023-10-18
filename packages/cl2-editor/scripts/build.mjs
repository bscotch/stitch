import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['./src/activate.ts'],
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
