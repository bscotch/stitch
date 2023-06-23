import type { InspectOptions } from 'util';

export type Log = (...args: any[]) => void;
export interface Logger {
  info: Log;
  log: Log;
  debug: Log;
  warn: Log;
  error: Log;
  dir: (obj: any, options?: InspectOptions) => void;
}
let loggerUtilitiy: Logger = console;

export function setLogger(logger: Logger) {
  loggerUtilitiy = logger;
}

export const logger = new Proxy<Logger>({} as any, {
  get: (target, prop) => {
    const log = (loggerUtilitiy as any)[prop];
    if (typeof log === 'function') {
      return log.bind(loggerUtilitiy);
    }
    return log;
  },
});
