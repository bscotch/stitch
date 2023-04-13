import { literal } from '@bscotch/utility';
import { build } from 'esbuild';
import { $, cd, fs } from 'zx';
import manifest from './package.json' assert { type: 'json' };

await $`mkdir -p bundle/code`;
await $`mkdir -p bundle/node_modules/@bscotch`;
await $`cp -rf assets bundle/assets`;

for (const depType of ['dependencies', 'devDependencies']) {
  for (const dep of Object.keys(manifest[depType])) {
    if (manifest[depType][dep].startsWith('workspace:')) {
      Reflect.deleteProperty(manifest[depType], dep);
    }
  }
}

// @ts-expect-error
manifest.dependencies = {
  '@bscotch/stitch-ui': 'file:./stitch-ui.tgz',
};
fs.writeJsonSync('bundle/package.json', manifest);

const interopBanner =
  "import { createRequire } from 'module';const require = createRequire(import.meta.url);";
const cjsPathConstsBanner =
  'const __filename = fileURLToPath(import.meta.url);const __dirname = path.dirname(__filename);';

const buildOptions = literal({
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['esnext'],
  keepNames: true,
  treeShaking: true,
  minify: false,
  banner: {
    js: interopBanner,
  },
});

await build({
  entryPoints: ['dist/main.mjs'],
  external: ['electron', 'dist/preload.cjs', '@bscotch/stitch-ui'],
  outfile: 'bundle/code/main.mjs',
  ...buildOptions,
});

await $`cp dist/preload.cjs bundle/code/`;
await $`cp dist/index.cjs bundle/code/`;
await $`cp forge.config.js bundle/`;
cd('../desktop-ui');
await $`pnpm pack --pack-destination ../desktop/bundle`;

cd('../desktop/bundle');
// await $`tar -zxvf *.tgz`;
// await $`rm *.tgz`;
// await $`mv package stitch-ui`;
await $`mv bscotch-stitch-ui-* stitch-ui.tgz`;
await $`cp ../cert.pfx .`;

await $`npm install`;

await $`npx electron-forge make`;
