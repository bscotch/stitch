import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';

const config: UserConfig = {
  plugins: [sveltekit()],
  define: {
    'process.env': {},
  },
  build: {
    target: 'esnext',
  },
};

export default config;
