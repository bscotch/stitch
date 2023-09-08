export interface Log {
  action: 'deleted' | 'moved';
  path: string;
  to?: string;
}

export interface BBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Issue {
  level: 'error' | 'warning';
  message: string;
  cause?: any;
}

export type AnyFunction<R> = (
  ...args: any
) => R extends Promise<infer U> ? Promise<U> : R;

export type Reporter = {
  report(value: {
    message?: string | undefined;
    /** Percentage points to add to the completion metric */
    increment?: number | undefined;
  }): void;
};
