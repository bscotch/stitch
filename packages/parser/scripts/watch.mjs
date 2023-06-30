import { pathy } from '@bscotch/pathy';
import esbuild from 'esbuild';

const paths = await pathy('src').listChildrenRecursively({
  includeExtension: 'ts',
});

const ctx = await esbuild.context({
  entryPoints: paths.map((p) => p.relative),
  bundle: false,
  outdir: 'dist',
});

await ctx.watch();
