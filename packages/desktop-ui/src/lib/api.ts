import type {
  IdeInstallEventPayload,
  IdeInstallStep,
} from '@bscotch/stitch-server/client';
import { createApi, subscribeToTrpc } from './api.connect.js';
import { alerts } from './store.alerts.js';

export * from '@bscotch/stitch-server/client';
export const trpc = await createApi();

await Promise.all([
  subscribeToTrpc<{ kind: 'error'; message?: string; code?: string }>(
    trpc,
    'onError',
    (err) => {
      console.error('TRPC ERROR', err);
      alerts.notify({
        kind: 'error',
        text: err.message || 'Something went wrong.',
      });
    },
  ),
  subscribeToTrpc<IdeInstallEventPayload>(
    trpc,
    'onGameMakerStatusChanged',
    (val) => {
      const { step, version } = val;
      console.log('GameMaker Status Changed', val);
      const messages: { [step in IdeInstallStep]?: string } = {
        installed: `GameMaker ${version} is installed`,
        installing: `Installing GameMaker ${version}...`,
        opened: `Opening GameMaker ${version}...`,
        searchingLocal: `Checking for GameMaker ${version} installation...`,
        failed: `Failed to open project`,
        login_required: `Login expired. Manually open GameMaker and login to allow Stitch Desktop to work.`,
      };
      const failureStates = new Set(['failed', 'login_required'] as const);
      const warningStates = new Set(['installing', 'searchingLocal'] as const);
      if (!messages[step]) {
        return;
      }
      alerts.notify({
        id: `gm-status-${version}`,
        kind: failureStates.has(step as any)
          ? 'error'
          : warningStates.has(step as any)
          ? 'warning'
          : 'success',
        text: messages[step]!,
        ttl: step === 'opened' ? 3 : undefined,
      });
    },
  ),
]);
