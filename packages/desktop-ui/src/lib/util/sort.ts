export function sortByField<T>(arr: T[], field: keyof T): T[] {
  return arr.sort((a, b) => {
    if (a[field] < b[field]) {
      return -1;
    } else if (a[field] > b[field]) {
      return 1;
    } else {
      return 0;
    }
  });
}
