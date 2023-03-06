import { Pathy } from '@bscotch/pathy';
import { imageSize } from 'image-size';

export interface Image {
  width: number;
  height: number;
  path: string;
}

export const sizeOf: (
  path: string,
) => Promise<{ width?: number; height?: number } | undefined> = (
  path: string,
) => {
  return new Promise((resolve, reject) => {
    imageSize(path, (err, dimensions) => {
      if (err) {
        reject(err);
      } else {
        resolve(dimensions);
      }
    });
  });
};

function isValidImage(data: unknown): data is Image {
  return (
    typeof data === 'object' &&
    data !== null &&
    'width' in data &&
    typeof data.width === 'number' &&
    'height' in data &&
    typeof data.height === 'number' &&
    'path' in data &&
    typeof data.path === 'string'
  );
}

export async function listImages(
  path: Pathy,
  options?: { maxResults?: number; relative?: boolean },
): Promise<Image[]> {
  if (!(await path.exists())) {
    return [];
  }
  const files: Partial<Image>[] = await path.listChildrenRecursively({
    includeExtension: 'png',
    softLimit: options?.maxResults,
    async transform(imagePath) {
      return {
        ...(await sizeOf(imagePath.absolute)),
        path: options?.relative ? imagePath.relative : imagePath.absolute,
      };
    },
  });
  return files.filter(isValidImage);
}
