
/** @see {@link https://stackoverflow.com/questions/56415826/is-it-possible-to-precisely-type-invert-in-typescript} */

type KeyFromValue<V, T extends Record<PropertyKey, PropertyKey>> = {
  [K in keyof T]: V extends T[K] ? K : never
}[keyof T];

export type Inverted<T extends Record<PropertyKey, PropertyKey>> = {
  [V in T[keyof T]]: KeyFromValue<V, T>
};

export type EmptyArray = readonly [];
