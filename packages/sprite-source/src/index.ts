import fs from 'fs';
import path from 'path';
import Piscina from 'piscina';
import sharp from 'sharp';

const piscina = new Piscina({
  // The URL must be a file:// URL
  filename: new URL('./worker.mjs', import.meta.url).href,
});

interface Options {
  root_folder: string;
  summary_filename: string;
  background_alpha: number;
  compute_border_box: boolean;
  force: boolean;
}

interface ImageSummary {
  name: string;
  width: number;
  height: number;
  border: any; // Replace 'any' with the type of your border
  checksum: string;
  changed: Date;
}

interface SpriteSourceSummary {
  path: string;
  count: number;
  border: any; // Replace 'any' with the type of your border
  frames: Record<string, ImageSummary>;
}

interface SpriteSourceRootSummary {
  sprite_count: number;
  frame_count: number;
  sprites: Record<string, any>; // Replace 'any' with the type of your sprites
}

interface BorderBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function mergeBorderBoxes(boxes: BorderBox[]): BorderBox | null {
  if (boxes.length === 0) {
    return null;
  }
  const merged = { ...boxes[0] };
  for (const box_ of boxes.slice(1)) {
    if (box_.left < merged.left) {
      merged.left = box_.left;
    }
    if (box_.right > merged.right) {
      merged.right = box_.right;
    }
    if (box_.top < merged.top) {
      merged.top = box_.top;
    }
    if (box_.bottom > merged.bottom) {
      merged.bottom = box_.bottom;
    }
  }
  return merged;
}

async function summarizeContents(
  filePath: string,
  options: Options,
): Promise<[string, { width: number; height: number }, BorderBox | null]> {
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

async function processFrame(
  file: string,
  dir: string,
  frameSummary: ImageSummary | undefined,
  options: Options,
): Promise<ImageSummary> {
  const name = path.basename(file);
  const filePath = path.join(dir, file);
  const stats = fs.statSync(filePath);
  const modifiedAt = stats.mtime;

  const changedTime = frameSummary?.changed
    ? new Date(frameSummary.changed)
    : null;
  const isUnchanged =
    !options.force && changedTime?.getTime() === modifiedAt.getTime();

  if (frameSummary && isUnchanged) {
    return frameSummary;
  }

  // Replace 'summarizeContents' with the actual function to compute the border
  const [checksum, metadata, border] = await piscina.run({ filePath, options });

  return {
    name,
    width: metadata.width!,
    height: metadata.height!,
    border: border,
    checksum,
    changed: modifiedAt,
  };
}

async function processSpriteDir(
  dir: string,
  spriteSourceSummary: Record<string, SpriteSourceSummary>,
  options: Options,
): Promise<SpriteSourceSummary | null> {
  const dirname = path.relative(options.root_folder, dir);
  const dirSummary = spriteSourceSummary[dirname];

  const pngFiles = fs
    .readdirSync(dir)
    .filter((file) => path.extname(file) === '.png');

  if (pngFiles.length === 0) {
    return null;
  }

  const images: ImageSummary[] = [];
  const waits: Promise<any>[] = [];
  for (const file of pngFiles) {
    const name = path.basename(file);
    waits.push(
      processFrame(file, dir, dirSummary?.frames[name], options).then((image) =>
        images.push(image),
      ),
    );
  }
  await Promise.all(waits);

  return {
    path: dirname,
    count: images.length,
    border: options.compute_border_box
      ? mergeBorderBoxes(images.map((img) => img.border))
      : null, // Replace 'mergeBorderBoxes' with the actual function to merge the borders
    frames: Object.fromEntries(images.map((img) => [img.name, img])),
  };
}

function getOutputFilename(options: Options): string {
  const filename = `${options.summary_filename}.json`;
  return `${options.root_folder}/${filename}`;
}

function loadSummary(options: Options): SpriteSourceRootSummary {
  const filePath = getOutputFilename(options);
  const start = Date.now();

  let summary: SpriteSourceRootSummary;
  try {
    const file = fs.readFileSync(filePath, 'utf8');
    summary = JSON.parse(file);
  } catch (err) {
    summary = {
      sprite_count: 0,
      frame_count: 0,
      sprites: {},
    };
  }

  console.log(`Loaded summary in ${Date.now() - start}ms`);
  return summary;
}

function getDirs(rootFolder: string, maxDepth: number): string[] {
  const spriteDirs: string[] = [];

  function walk(dir: string, depth: number = 0): void {
    if (depth > maxDepth) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        spriteDirs.push(filePath);
        walk(filePath, depth + 1);
      }
    }
  }

  walk(rootFolder);
  return spriteDirs;
}

async function updateSpriteSourceSummary(
  options: Options,
): Promise<SpriteSourceRootSummary> {
  const summary = loadSummary(options);
  const sprites = summary.sprites;
  const maxDepth = 1;
  const dirs = await Promise.all(
    getDirs(options.root_folder, maxDepth).map((dir) =>
      processSpriteDir(dir, sprites, options),
    ),
  );

  const spriteSources = dirs.filter(
    (s) => s && s.count > 0,
  ) as SpriteSourceSummary[];

  const rootSummary: SpriteSourceRootSummary = {
    sprite_count: spriteSources.length,
    frame_count: spriteSources.reduce((sum, s) => sum + s.count, 0),
    sprites: spriteSources.reduce((obj, s) => ({ ...obj, [s.path]: s }), {}),
  };

  await writeSummary(rootSummary, options);
  return rootSummary;
}

async function writeSummary(
  rootSummary: SpriteSourceRootSummary,
  options: Options,
): Promise<void> {
  const start = Date.now();
  const serialized = JSON.stringify(rootSummary, null, 2);
  await fs.promises.writeFile(getOutputFilename(options), serialized);
  console.log(`Wrote summary in ${Date.now() - start}ms`);
}

async function main() {
  const options: Options = {
    root_folder: '../../../crashlands-2/Crashlands2/sprites',
    summary_filename: '.sprite-info',
    background_alpha: 1,
    compute_border_box: true,
    force: false,
  };
  const start = Date.now();
  await updateSpriteSourceSummary(options);
  console.log(`Finished in ${Date.now() - start}ms`);
}

await main();
