export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}
