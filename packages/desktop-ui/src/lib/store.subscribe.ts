import type { StartStopNotifier } from 'svelte/store';
import { trpc, type TrpcSubscriptionRoute } from './api.js';

export function generateTrpcStartStopNotifier<
  T,
  R extends TrpcSubscriptionRoute,
>(
  route: R[] | R,
  options?: {
    transform?: (value: unknown, route: R) => T;
  },
): StartStopNotifier<T> {
  return (set) => {
    const routes = Array.isArray(route) ? route : [route];
    const trpcUnsubs = routes.map((route) =>
      trpc[route as TrpcSubscriptionRoute].subscribe(undefined, {
        onError(err) {
          console.error('TRPC STARTSTOP ERROR', route, err);
        },
        onData(value) {
          console.log('RECEIVED SUB DATA', route, value);
          set(
            options?.transform ? options.transform(value, route) : (value as T),
          );
        },
      }),
    );
    const onLastUnsub = () => {
      trpcUnsubs.forEach((u) => u.unsubscribe());
    };
    return onLastUnsub;
  };
}
