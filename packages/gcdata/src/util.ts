export function objectToMap<T>(obj: T): Map<keyof T, T[keyof T]> {
  const map = new Map<keyof T, T[keyof T]>();
  for (const key in obj) {
    map.set(key, obj[key]);
  }
  return map;
}

export function resolvePointer(pointer: string, data: any) {
  const parts = pointer.split('/');
  let current = data;
  for (let i = 0; i < parts.length; i++) {
    if (typeof current !== 'object') {
      return;
    }
    current = current[parts[i]];
  }
  return current;
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}
