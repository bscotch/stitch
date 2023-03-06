import { getModuleDir } from '@bscotch/utility';
import { resolve } from 'path';

export const packageDirectory = resolve(getModuleDir(import.meta), '..', '..');

export const assetsDirectory = resolve(packageDirectory, 'assets');
