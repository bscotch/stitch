import esbuild from 'esbuild';

// CREATE THE BUNDLE
esbuild.build({
  entryPoints: ['./src/extension.js'],
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
});
