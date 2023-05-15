let logging = false;

export function enableLogging() {
  logging = true;
}

export function disableLogging() {
  logging = false;
}

export function log(...args: unknown[]) {
  if (logging) {
    console.log(...args);
  }
}
