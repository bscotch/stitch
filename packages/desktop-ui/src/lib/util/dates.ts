export function daysAgo(date: Date) {
  const now = Date.now();
  const millisAgo = now - date.getTime();
  const daysAgo = millisAgo / 1000 / 60 / 60 / 24;
  return Math.round(daysAgo);
}

export function isNewer(a: Date | string, comparedTo: Date | string) {
  const aDate = new Date(a);
  const comparedToDate = new Date(comparedTo);
  return aDate > comparedToDate;
}

export function isOlder(a: Date | string, comparedTo: Date | string) {
  const aDate = new Date(a);
  const comparedToDate = new Date(comparedTo);
  return aDate < comparedToDate;
}

export function toDateIso(date: string | Date) {
  return new Date(date).toISOString();
}

export function toDateLocal(date: string | Date) {
  return new Date(date).toLocaleDateString();
}
