import type { Api } from '@bscotch/stitch-server/client';
import {
  createTRPCProxyClient,
  createWSClient,
  wsLink,
  type CreateTRPCProxyClient,
} from '@trpc/client';
import type { Unsubscribable } from '@trpc/server/observable';
import superjson from 'superjson';
import { alerts } from './store.alerts.js';
import { serverPort } from './util/info.js';

type WSClient = ReturnType<typeof createWSClient>;
type Trpc = CreateTRPCProxyClient<Api>;
export type TrpcSubscriptionRoute = {
  [R in keyof Trpc]: Trpc[R] extends {
    subscribe: (...args: any) => any;
  }
    ? R
    : never;
}[keyof Trpc];

export async function createApi() {
  return createTRPCProxyClient<Api>({
    transformer: superjson,
    links: [
      wsLink({
        client: await createClient(),
      }),
    ],
  });
}

async function createClient(): Promise<WSClient> {
  const client = createWSClient({
    url: `ws://localhost:${serverPort}`,
    retryDelayMs(attempt) {
      console.log('RETRYING CONNECTION', attempt);
      return Math.pow(attempt + 1, 2) * 1000;
    },

    onOpen() {
      console.log('OPENED CONNECTION');
      alerts.dismiss('lost-connection');
    },
    onClose(cause) {
      console.log('CLOSED CONNECTION', cause);
      alerts.notify({
        text: `Lost connection to Stitch server: ${cause?.code}`,
        kind: 'error',
        id: 'lost-connection',
        ttl: 5,
      });
    },
  });
  const ws = client.getConnection();
  return await new Promise((res, rej) => {
    ws.onopen = () => {
      console.log('Websocket connection opened');
      return res(client);
    };
    ws.onerror = (err) => {
      console.error('Websocket connection failed', err);
    };
  });
}

export function subscribeToTrpc<T>(
  trpc: CreateTRPCProxyClient<Api>,
  route: TrpcSubscriptionRoute,
  onData: (data: T) => void,
): Unsubscribable {
  return trpc[route].subscribe(undefined, {
    onError(err) {
      console.error('TRPC SUBSCRIPTION ERROR', route, err);
    },
    onData(value) {
      return onData(value as T);
    },
  });
}
