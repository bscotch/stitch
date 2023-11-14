import type { FileRetryOptions } from '@bscotch/pathy';

export const MAX_FIO_RETRIES = 20;
export const FIO_RETRY_DELAY = 100;

export const retryOptions: FileRetryOptions = {
  maxRetries: MAX_FIO_RETRIES,
  retryDelayMillis: FIO_RETRY_DELAY,
};
