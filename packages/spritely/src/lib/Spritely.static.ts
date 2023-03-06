import { default as nonRetryFs } from 'fs-extra';
import { Image } from 'image-js';
import path from 'path';

// The 'image-size' module allows for synchronous operation,
// which is not provided by 'sharp' (the primary image manipulation pipeline),
// but is needed since Typescript constructors are synchronous.
import { imageSize } from 'image-size';
import {
  assert,
  assertNonEmptyArray,
  assertNumberGreaterThanZero,
  ErrorCodes,
} from './errors.js';
import { GradientMap } from './GradientMap.js';
import { ImageExt, SpriteEdgeCorrectionOptions } from './Spritely.types.js';
import { sha256 } from './utility.js';

export class SpritelyStatic {
  /**
   * Given a folder (sprite) of PNG images (subimages), return the paths
   * to all subimages.
   */
  static getSubimages(dir: string) {
    const subimagePaths = nonRetryFs
      .readdirSync(dir)
      .filter((subimagePath) => subimagePath.endsWith('.png'))
      .map((subimagePath) => path.join(dir, subimagePath));
    assert(subimagePaths.length, ErrorCodes.noImagesFound);
    return subimagePaths;
  }

  /**
   * Given a bunch of subimages, return the dimensions of those
   * subimages. Throw an error if any subimage is a different size than the others.
   * @param path A folder containing subimages, or an array of subimage paths
   */
  static getSubimagesSizeSync(
    path: string | string[],
    allowSizeMismatch = false,
  ) {
    const subimages = Array.isArray(path)
      ? path
      : SpritelyStatic.getSubimages(path);
    assertNonEmptyArray(subimages, ErrorCodes.noImagesFound);
    if (allowSizeMismatch) {
      return { height: undefined, width: undefined };
    }
    const expectedSize = SpritelyStatic.getImageSizeSync(subimages[0]);
    subimages.forEach((subimage) => {
      const { width, height } = SpritelyStatic.getImageSizeSync(subimage);
      assert(
        width === expectedSize.width,
        `Subimage '${subimage}' has width ${width}; expected ${expectedSize.width}`,
        ErrorCodes.sizeMismatch,
      );
      assert(
        height === expectedSize.height,
        `Subimage '${subimage}' has height ${height}; expected ${expectedSize.height}`,
        ErrorCodes.sizeMismatch,
      );
    });
    return expectedSize;
  }

  /** Synchronously get the size of an image */
  static getImageSizeSync(path: string) {
    const dims = imageSize(path);
    assertNumberGreaterThanZero(dims.width, `'${path}' width is not >0`);
    assertNumberGreaterThanZero(dims.height, `'${path}' height is not >0`);
    return {
      width: dims.width as number,
      height: dims.height as number,
    };
  }

  static async bleed(imagePath: string, options?: SpriteEdgeCorrectionOptions) {
    const img = (await Image.load(imagePath)) as ImageExt;
    assert(img.alpha, 'Images must have an alpha channel to be corrected.');
    const maxPixelValue = Math.pow(2, img.bitDepth);
    const bleedMaxAlpha = Math.ceil(0.02 * maxPixelValue);
    const alphaChannel = img.channels - 1;
    const nonAlphaChannels = [...Array(img.channels - 1)].map((v, i) => i);
    const transparentBlackPixel = [...Array(img.channels)].map(() => 0);
    if (options?.createdBy == 'inkscape') {
      // Inkscape adds a rgba(255,255,255,1) 1px border around blurs. Remove it!
      for (let pixel = 0; pixel < img.size; pixel++) {
        const rgba = img.getPixel(pixel);
        if (
          nonAlphaChannels.every((channel) => rgba[channel] == maxPixelValue) &&
          rgba[alphaChannel] == 1
        ) {
          img.setPixel(pixel, transparentBlackPixel);
        }
      }
    }
    // Create a mask from the background (alpha zero) and then erode it by a few pixels.
    // Add a mask from the foreground (alpha > 0)
    // Invert to get the background pixels that need to be adjusted
    // Set the color of those pixels to the the color of the nearest foreground, and the alpha
    // to something very low so that it mostly isn't visible but won't be treated as background downstream
    const foreground = SpritelyStatic.getForegroundMask(
      img,
      (bleedMaxAlpha + 1) / maxPixelValue,
    );
    const expandedForeground = foreground.dilate({
      kernel: [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
      ],
    }) as ImageExt;

    const isInForeground = (x: number, y: number) => foreground.getBitXY(x, y);
    const isInExpandedForeground = (x: number, y: number) =>
      expandedForeground.getBitXY(x, y);
    const isInOutline = (x: number, y: number) =>
      isInExpandedForeground(x, y) && !isInForeground(x, y);

    // There does not seem to be a way to combine masks in image-js,
    // but we don't really need to for the desired outcome.
    // Iterate over all pixels. Those in the expanded foreground but not in the foreground
    // should be set in the original image based on nearby non-background pixels
    for (let x = 0; x < img.width; x++) {
      for (let y = 0; y < img.height; y++) {
        if (isInOutline(x, y)) {
          const neighbors = [];
          for (let ax = x - 1; ax <= x + 1; ax++) {
            for (let ay = y - 1; ay <= y + 1; ay++) {
              if (ax == x && ay == y) {
                continue;
              }
              if (isInForeground(ax, ay)) {
                neighbors.push(img.getPixelXY(ax, ay));
              }
            }
          }
          if (neighbors.length) {
            // average the colors
            const colorSamples: number[][] = transparentBlackPixel.map(
              () => [],
            );
            for (const neighbor of neighbors) {
              for (let channel = 0; channel < img.channels; channel++) {
                colorSamples[channel].push(neighbor[channel]);
              }
            }
            const newColor = colorSamples.map((sample, idx) => {
              if (idx == img.channels - 1) {
                // Alpha should be 2% or half the min neighboring alpha
                const minAlpha = sample.reduce(
                  (min, value) => Math.min(min, value),
                  Infinity,
                );
                return Math.ceil(Math.min(minAlpha * 0.5, bleedMaxAlpha));
              } else {
                // Use the average color
                return Math.round(
                  sample.reduce((sum, value) => sum + value, 0) / sample.length,
                );
              }
            });
            img.setPixelXY(x, y, newColor);
          }
        }
      }
    }
    await img.save(imagePath);
  }

  static cropObjectFromBoundingBox(boundingBox: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }) {
    return {
      x: boundingBox.left,
      y: boundingBox.top,
      width: boundingBox.right - boundingBox.left + 1,
      height: boundingBox.bottom - boundingBox.top + 1,
    };
  }

  /** Crop an image in-place. */
  static async cropImage(
    imagePath: string,
    cropObject: { x: number; y: number; width: number; height: number },
  ) {
    const img = (await Image.load(imagePath)) as ImageExt;
    await img.crop(cropObject).save(imagePath);
  }

  /**
   * Check if two images are exactly equal *in pixel values*
   * (ignoring metadata).
   */
  static async imagesAreEqual(imagePath1: string, imagePath2: string) {
    const img1 = (await Image.load(imagePath1)) as ImageExt;
    const img2 = (await Image.load(imagePath2)) as ImageExt;
    // Start with cheap checks, then check value-by-value aborting when one fails.
    return (
      img1.channels == img2.channels &&
      img1.bitDepth == img2.bitDepth &&
      img1.alpha == img2.alpha &&
      img1.size == img2.size &&
      img1.data.every((value: number, idx: number) => value == img2.data[idx])
    );
  }

  /**
   * Compute a checksum based on the pixel values of an image.
   * Remains static even when file metadata changes.
   */
  static async pixelsChecksum(imagePath: string) {
    const values = ((await Image.load(imagePath)) as Image).data;
    return sha256(Buffer.from(values));
  }

  /**
   * Get the foreground mask (a binary image) of an image from
   * thresholding based on the alpha channel.
   * @param foregroundMinAlphaFraction The minimum alpha value of the foreground.
   * Any alpha >= than this is considered foreground. On a 0-1 scale.
   * Defaults to 1/bitDepth (i.e. any alpha besides 0 is foreground)
   */
  static getForegroundMask(
    image: ImageExt,
    foregroundMinAlphaFraction?: number,
  ) {
    const threshold =
      foregroundMinAlphaFraction || 1 / Math.pow(2, image.bitDepth);
    return image.getChannel(image.channels - 1).mask({ threshold }) as ImageExt;
  }

  static getForegroundBounds(image: ImageExt, padding = 0) {
    const foreground = SpritelyStatic.getForegroundMask(image);
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let x = 0; x < foreground.width; x++) {
      for (let y = 0; y < foreground.height; y++) {
        if (foreground.getBitXY(x, y)) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    padding = Math.round(padding);
    if (padding > 0) {
      top = Math.max(top - padding, 0);
      left = Math.max(left - padding, 0);
      right = Math.min(right + padding, foreground.width - 1);
      bottom = Math.min(bottom + padding, foreground.height - 1);
    }
    return {
      left: left == Infinity ? 0 : left,
      right: right == -Infinity ? foreground.width - 1 : right,
      top: top == Infinity ? 0 : top,
      bottom: bottom == -Infinity ? foreground.height - 1 : bottom,
    };
  }

  static async applyGradientMap(path: string, gradient: GradientMap) {
    const image = (await Image.load(path)) as ImageExt;
    const isRgb =
      (image.alpha && image.channels == 4) ||
      (!image.alpha && image.channels == 3);
    for (let x = 0; x < image.width; x++) {
      for (let y = 0; y < image.height; y++) {
        const currentColor = image.getPixelXY(x, y);
        const getRelativeIntensity = (value: number) =>
          value / Math.pow(2, image.bitDepth);
        if (!image.alpha || currentColor[image.channels - 1] > 0) {
          let relativeIntensity = getRelativeIntensity(currentColor[0]);
          const pixelIsGray = currentColor.every((value, i) => {
            const isAlphaChannel = image.alpha && i == image.channels - 1;
            if (isAlphaChannel) {
              return true;
            }
            return value == currentColor[0];
          });
          // (assumed to be grayscale, so that all values are the same)
          if (!pixelIsGray) {
            assert(isRgb, `Images must be in grayscale or RGB(A) color.`);
            // Then this pixel isn't grayscale, so compute intensity
            relativeIntensity = getRelativeIntensity(
              0.2126 * currentColor[0] +
                0.7152 * currentColor[1] +
                0.0722 * currentColor[2],
            );
          }
          const newPosition = Math.floor(relativeIntensity * 100);
          const newColor = gradient.getColorAtPosition(newPosition);
          image.setPixelXY(x, y, newColor.rgb);
        }
      }
    }
    await image.save(path);
  }
}
