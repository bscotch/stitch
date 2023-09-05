export type AnyFunc = (...args: any) => any;
export type Checked<T extends AnyFunc> =
  | [error: Error, result: null]
  | [error: null, result: ReturnType<T>];

export type AsyncableChecked<T extends AnyFunc> =
  ReturnType<T> extends Promise<any> ? Promise<Checked<T>> : Checked<T>;

export function check<T extends AnyFunc>(
  func: T,
  message: string,
): AsyncableChecked<T> {
  const handleError = (err: unknown): [Error, null] => {
    const error = new Error(message);
    error.cause = err;
    return [error, null];
  };
  try {
    const result = func();
    // Handle async functions
    if (result instanceof Promise) {
      return result.then(
        (result) => [null, result],
        (cause) => handleError(cause),
      ) as AsyncableChecked<T>;
    }
    return [null, result] as AsyncableChecked<T>;
  } catch (cause) {
    return handleError(cause) as AsyncableChecked<T>;
  }
}

export function rethrow(cause: any, message: string) {
  const error = new Error(message);
  error.cause = cause;
  throw error;
}
