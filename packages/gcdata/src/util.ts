export function objectToMap<T>(obj: T): Map<keyof T, T[keyof T]> {
  const map = new Map<keyof T, T[keyof T]>();
  for (const key in obj) {
    map.set(key, obj[key]);
  }
  return map;
}
