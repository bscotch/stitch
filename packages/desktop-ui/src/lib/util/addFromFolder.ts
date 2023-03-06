// import { useMachine } from '@xstate/svelte';
import { trpc } from '$lib/api.js';
import { alerts } from '$lib/store.js';
import type { AlertPartial } from '$lib/types.js';
import { TRPCClientError } from '@trpc/client';
import { assign, createMachine, interpret } from 'xstate';

interface Schema {
  events: {
    type: 'chooseFolder';
  };
  services: {
    pickDirectory: { data: string | null };
    addFromDirectory: { data: undefined };
  };
}

export function createAddFromFolderMachine(options: {
  alertId: string;
  addFromFolder: (directory: string) => Promise<any>;
  buttonLabel?: string;
  message?: string;
  title?: string;
}) {
  const addFromFolderMachine = createMachine(
    {
      context: {
        directory: null as string | null,
        buttonLabel: options.buttonLabel,
        message: options.message,
        title: options.title,
      },
      tsTypes: {} as import('./addFromFolder.typegen.js').Typegen0,
      schema: {} as Schema,
      predictableActionArguments: true,
      id: 'addFromFolder',
      initial: 'idle',
      states: {
        idle: {
          on: {
            chooseFolder: {
              target: 'pickingFolder',
            },
          },
        },
        pickingFolder: {
          invoke: {
            src: 'pickDirectory',
            onDone: {
              target: 'searchingFolder',
              actions: 'storeFolder',
            },
            onError: {
              target: 'idle',
              actions: 'showError',
            },
          },
          on: {
            chooseFolder: {
              actions: 'notifyInProgress',
            },
          },
        },
        searchingFolder: {
          invoke: {
            src: 'addFromDirectory',
            onDone: 'idle',
            onError: {
              target: 'idle',
              actions: 'showError',
            },
          },
          on: {
            chooseFolder: {
              actions: 'notifyInProgress',
            },
          },
        },
      },
    },
    {
      actions: {
        notifyInProgress: () => {
          alerts.notify({
            id: 'alreadyAddingProjects',
            ttl: 5,
            text: 'Already spawned a file-picker dialog. You may need to Alt+Tab to it!',
            kind: 'warning',
          });
        },
        storeFolder: assign({
          directory: (_, event) => {
            return event.data;
          },
        }),
        showError: (_, event) => {
          const error = event.data;
          console.error(error);
          const alert: AlertPartial = {
            id: options.alertId,
            kind: 'error',
            text: 'Something went wrong!',
            ttl: 6,
          };
          if (error instanceof TRPCClientError) {
            alert.text = `${error.data.code}: Stitch server could not parse inputs for ${error.data.path} `;
          } else if (error instanceof Error) {
            alert.text = error.message;
          }
          alerts.notify(alert);
        },
      },
      services: {
        async pickDirectory(ctx) {
          const picker =
            window.electron?.pickDirectory || trpc.pickDirectory.query;
          const dir = await picker({
            title: ctx.title,
            buttonLabel: ctx.buttonLabel,
            message: ctx.message,
          });
          return dir;
        },
        async addFromDirectory(ctx) {
          const { directory } = ctx;
          if (!directory) {
            alerts.notify({
              id: options.alertId,
              text: 'No directory selected',
              kind: 'info',
              ttl: 3,
            });
            return;
          }
          if (typeof directory !== 'string') {
            alerts.notify({
              id: options.alertId,
              text: 'Invalid directory selected',
              kind: 'error',
              ttl: 5,
            });
            return;
          }
          alerts.notify({
            id: options.alertId,
            text: 'Searching for projects to add...',
            kind: 'info',
            icon: 'search',
          });
          await options.addFromFolder(directory);
          alerts.notify({
            id: options.alertId,
            text: `Search complete!`,
            kind: 'success',
            ttl: 3,
          });
          return undefined;
        },
      },
    },
  );

  return interpret(addFromFolderMachine).start();
}
