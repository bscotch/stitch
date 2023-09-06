import crypto from 'crypto';
import fs from 'fs';
import sharp from 'sharp';

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

export default async function computeChecksum(
  filePath: string,
): Promise<string> {
  if (!filePath.match(/\.png$/i)) {
    return await quickChecksum(filePath);
  }

  const img = sharp(filePath);
  const metadata = await img.metadata();
  const width = metadata.width!;
  const height = metadata.height!;
  const pixels = await img.raw().toBuffer();

  let checksum = 0n;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];

      checksum +=
        BigInt(r) +
        BigInt(g) * 256n +
        BigInt(b) * 65536n +
        BigInt(a) * 16777216n;
    }
  }

  const checksumString = checksum.toString(16);
  return checksumString;
}
