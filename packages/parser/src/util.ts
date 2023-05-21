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

function jsonReplacer(key: string, value: unknown) {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  return value;
}

export function stringify(obj: unknown) {
  return JSON.stringify(obj, jsonReplacer, 2);
}
