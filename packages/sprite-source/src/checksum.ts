import crypto from 'crypto';
import Piscina from 'piscina';

const piscina = new Piscina({
  // The URL must be a file:// URL
  filename: new URL('./checksum.piscina.mjs', import.meta.url).href,
});

export function computeFileChecksum(path: string): Promise<string> {
  return piscina.run(path);
}

export async function computeFilesChecksum(paths: string[]): Promise<string> {
  const checksums = await Promise.all(paths.map(computeFileChecksum));
  return computeStringChecksum(checksums.join('-'));
}

export function computeStringChecksum(str: string): string {
  const hash = crypto.createHash('md5');
  hash.update(str);
  return hash.digest('hex');
}
