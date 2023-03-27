import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

export const name = {
  long: 'Stitch Desktop',
  short: 'Stitch',
};
export const bundleRoot = path.dirname(fileURLToPath(import.meta.url));
export const stitchConfigDir = path.join(os.homedir(), '.stitch');
export const uriProtocol = 'bscotch.stitch-desktop';
export const updateFeed = `https://github.com/bscotch/stitch/releases/latest/download`;
