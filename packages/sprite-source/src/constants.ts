import type { FileRetryOptions } from '@bscotch/pathy';

export const MAX_FIO_RETRIES = 20;
export const FIO_RETRY_DELAY = 100;

export const retryOptions: FileRetryOptions = {
  maxRetries: MAX_FIO_RETRIES,
  retryDelayMillis: FIO_RETRY_DELAY,
};

export const spriteDestConfigFilename = 'sprites.import.json';

export const spriteCacheFilename = 'sprites.info.json';

export const jsonSchemaRemoteDir =
  'https://raw.githubusercontent.com/bscotch/stitch/refs/heads/develop/packages/sprite-source/schemas/';
