import { alerts } from '$lib/store.alerts.js';
import { createMachine, interpret } from 'xstate';

type Event<Name extends string> = { type: Name };

interface Schema {
  events: Event<'connect'>;
  services: {
    connect: { data: void };
    load: { data: void };
  };
}

export function initialize() {
  const machine = createMachine(
    {
      context: {},
      tsTypes: {} as import('./init.typegen.js').Typegen0,
      schema: {} as Schema,
      predictableActionArguments: true,
      id: 'addFromFolder',
      initial: 'idle',
      states: {
        idle: {
          on: {
            connect: {
              target: 'connecting',
            },
          },
        },
        connecting: {
          invoke: {
            src: 'connect',
            onDone: 'connected',
            onError: 'failed',
          },
        },
        connected: {
          always: 'loading',
        },
        loading: {
          invoke: {
            src: 'load',
            onDone: 'ready',
            onError: 'failed',
          },
        },
        ready: {
          type: 'final',
        },
        failed: {
          type: 'final',
          entry() {
            alerts.notify({
              kind: 'error',
              text: 'Failed to connect to server',
            });
          },
        },
      },
    },
    {
      services: {
        async connect() {
          await import('./api.js');
          return;
        },
        async load() {
          await import('./store.js');
        },
      },
    },
  );
  return interpret(machine).start();
}
