import { computePngChecksum } from '@bscotch/pixel-checksum';
import crypto from 'crypto';
import fs from 'fs';

/**
 * A quick checksum for arbitrary file types, focusing on
 * speed. This is not a cryptographic hash.
 */
export function quickChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export async function computeFileChecksum(filePath: string): Promise<string> {
  if (!filePath.match(/\.png$/i)) {
    return await quickChecksum(filePath);
  }
  return computePngChecksum(filePath);
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
