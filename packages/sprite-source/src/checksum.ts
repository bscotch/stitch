import { computePngChecksum } from '@bscotch/pixel-checksum';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';

/**
 * A quick checksum for arbitrary text-based file types
 * (like JSON or atlas), where newlines are first normalized.
 */
async function textFileChecksum(filePath: string): Promise<string> {
  const content = await fsp.readFile(filePath, 'utf8');
  const normalized = content.replace(/\r/g, '').trim();
  return computeStringChecksum(normalized);
}

export async function computeFileChecksum(filePath: string): Promise<string> {
  if (!filePath.match(/\.png$/i)) {
    return await textFileChecksum(filePath);
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
