import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export const packageDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);

export const assetsDirectory = resolve(packageDirectory, 'assets');
