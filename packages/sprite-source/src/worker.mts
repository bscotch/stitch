import sharp from 'sharp';

interface Options {
  root_folder: string;
  summary_filename: string;
  background_alpha: number;
  compute_border_box: boolean;
  force: boolean;
}
interface BorderBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export default async function summarizeContents({
  filePath,
  options,
}: {
  filePath: string;
  options: Options;
}): Promise<[string, { width: number; height: number }, BorderBox | null]> {
  const img = sharp(filePath);
  const metadata = await img.metadata();
  const width = metadata.width!;
  const height = metadata.height!;
  const pixels = await img.raw().toBuffer();

  let checksum = 0n;
  const borderBox: BorderBox = {
    left: width,
    right: 0,
    top: height,
    bottom: 0,
  };

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

      if (!options.compute_border_box || a < options.background_alpha) {
        continue;
      }

      if (x < borderBox.left) {
        borderBox.left = x;
      }
      if (x > borderBox.right) {
        borderBox.right = Math.min(x, width - 1);
      }
      if (y < borderBox.top) {
        borderBox.top = y;
      }
      if (y > borderBox.bottom) {
        borderBox.bottom = Math.min(y, height - 1);
      }
    }
  }

  const checksumString = checksum.toString(16);
  return options.compute_border_box
    ? [checksumString, { width, height }, borderBox]
    : [checksumString, { width, height }, null];
}
