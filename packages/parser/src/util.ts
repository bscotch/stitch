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

function jsonReplacer(key: string, value: unknown): unknown {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      obj[k] = v;
    }
    return jsonReplacer(key, obj);
  }
  if (typeof value === 'function' && key === 'toJSON') {
    return jsonReplacer(key, value());
  }
  return value;
}

export function stringify(obj: unknown) {
  return JSON.stringify(obj, jsonReplacer, 2);
}

/**
 * There are multiple ways that Feather/GameMaker accept types to
 * be encoded in strings. To simplify parsing on our end, we normalize
 * them all to a single format. */
export function normalizeTypeString(typeString: string): string {
  typeString = typeString
    .replace(/\[/g, '<')
    .replace(/\]/g, '>')
    .replace(/,|\s+or\s+/gi, '|');
  // Sometimes specific array types are specified with e.g. Array.String
  // instead of Array<String>. Normalize those.
  typeString = typeString.replace(/^Array\.([A-Z][A-Z0-9]*)/gi, 'Array<$1>');
  return typeString;
}
