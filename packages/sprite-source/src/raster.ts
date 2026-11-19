import { convertIndexedToRgb, decode, encode } from 'fast-png';

type RasterData = Uint8Array | Uint16Array;

/**
 * A minimal in-memory bitmap, supporting just the
 * operations needed for sprite-source transforms.
 *
 * Pixel data is stored in the channel layout and bit depth
 * of the source PNG (greyscale, greyscale+alpha, RGB, or RGBA
 * at 8 or 16 bits per channel). Indexed-color PNGs are expanded
 * to 8-bit RGB (or RGBA if they have transparency), and
 * greyscale with fewer than 8 bits is expanded to 8-bit.
 */
export class Raster {
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly bitDepth: 8 | 16;
  readonly data: RasterData;

  constructor(
    width: number,
    height: number,
    channels: number,
    bitDepth: 8 | 16,
    data?: RasterData,
  ) {
    this.width = width;
    this.height = height;
    this.channels = channels;
    this.bitDepth = bitDepth;
    const size = width * height * channels;
    this.data =
      data || (bitDepth === 16 ? new Uint16Array(size) : new Uint8Array(size));
    if (this.data.length !== size) {
      throw new Error(
        `Raster data length ${this.data.length} does not match ${width}x${height}x${channels}`,
      );
    }
  }

  /** Whether the last channel is an alpha channel */
  get hasAlpha(): boolean {
    return this.channels === 2 || this.channels === 4;
  }

  get maxValue(): number {
    return 2 ** this.bitDepth - 1;
  }

  static fromPng(png: Uint8Array): Raster {
    const decoded = decode(png);
    const { width, height } = decoded;
    if (decoded.palette) {
      return new Raster(
        width,
        height,
        decoded.palette[0].length,
        8,
        convertIndexedToRgb(decoded),
      );
    }
    if (decoded.depth === 8 || decoded.depth === 16) {
      return new Raster(
        width,
        height,
        decoded.channels,
        decoded.depth,
        decoded.data as RasterData,
      );
    }
    // Sub-byte greyscale (1, 2, or 4 bits): expand to 8 bits
    const depth = decoded.depth;
    const scale = 255 / (2 ** depth - 1);
    const valuesPerByte = 8 / depth;
    const bytesPerRow = Math.ceil(width / valuesPerByte);
    const mask = 2 ** depth - 1;
    const data = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte =
          decoded.data[y * bytesPerRow + Math.floor(x / valuesPerByte)];
        const shift = 8 - depth * ((x % valuesPerByte) + 1);
        data[y * width + x] = Math.round(((byte >> shift) & mask) * scale);
      }
    }
    return new Raster(width, height, 1, 8, data);
  }

  toPng(): Uint8Array {
    return encode({
      width: this.width,
      height: this.height,
      channels: this.channels,
      depth: this.bitDepth,
      data: this.data,
    });
  }

  getPixel(x: number, y: number): number[] {
    const start = (y * this.width + x) * this.channels;
    return Array.from(this.data.subarray(start, start + this.channels));
  }

  setPixel(x: number, y: number, values: number[]) {
    this.data.set(values, (y * this.width + x) * this.channels);
  }

  crop(box: { x: number; y: number; width: number; height: number }): Raster {
    const { x, y, width, height } = box;
    if (
      x < 0 ||
      y < 0 ||
      width < 1 ||
      height < 1 ||
      x + width > this.width ||
      y + height > this.height
    ) {
      throw new Error(
        `Crop box ${JSON.stringify(box)} is outside of the ${this.width}x${this.height} image`,
      );
    }
    const cropped = new Raster(width, height, this.channels, this.bitDepth);
    const rowLength = width * this.channels;
    for (let row = 0; row < height; row++) {
      const start = ((y + row) * this.width + x) * this.channels;
      cropped.data.set(
        this.data.subarray(start, start + rowLength),
        row * rowLength,
      );
    }
    return cropped;
  }

  /**
   * Create a mask of pixels whose alpha is at least
   * `minAlphaFraction` of the max channel value.
   * Images without an alpha channel are fully opaque,
   * so every pixel is included.
   */
  alphaMask(minAlphaFraction: number): Mask {
    const mask = new Mask(this.width, this.height);
    if (!this.hasAlpha) {
      mask.bits.fill(1);
      return mask;
    }
    const threshold = minAlphaFraction * this.maxValue;
    const alphaOffset = this.channels - 1;
    for (let i = 0; i < mask.bits.length; i++) {
      if (this.data[i * this.channels + alphaOffset] >= threshold) {
        mask.bits[i] = 1;
      }
    }
    return mask;
  }
}

/** A binary image, where each pixel is either set or not. */
export class Mask {
  readonly width: number;
  readonly height: number;
  readonly bits: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.bits = new Uint8Array(width * height);
  }

  /** Whether the pixel is set (out-of-bounds pixels are not) */
  get(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return false;
    }
    return this.bits[y * this.width + x] === 1;
  }

  /** Expand the mask by one pixel in every direction (including diagonals) */
  dilate(): Mask {
    const dilated = new Mask(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        neighbors: for (let ny = y - 1; ny <= y + 1; ny++) {
          for (let nx = x - 1; nx <= x + 1; nx++) {
            if (this.get(nx, ny)) {
              dilated.bits[y * this.width + x] = 1;
              break neighbors;
            }
          }
        }
      }
    }
    return dilated;
  }
}
