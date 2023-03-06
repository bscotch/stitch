// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true;
  internalEvents: {
    '': { type: '' };
    'error.platform.addFromFolder.connecting:invocation[0]': {
      type: 'error.platform.addFromFolder.connecting:invocation[0]';
      data: unknown;
    };
    'error.platform.addFromFolder.loading:invocation[0]': {
      type: 'error.platform.addFromFolder.loading:invocation[0]';
      data: unknown;
    };
    'xstate.init': { type: 'xstate.init' };
  };
  invokeSrcNameMap: {
    connect: 'done.invoke.addFromFolder.connecting:invocation[0]';
    load: 'done.invoke.addFromFolder.loading:invocation[0]';
  };
  missingImplementations: {
    actions: never;
    services: never;
    guards: never;
    delays: never;
  };
  eventsCausingActions: {};
  eventsCausingServices: {
    connect: 'connect';
    load: '';
  };
  eventsCausingGuards: {};
  eventsCausingDelays: {};
  matchesStates:
    | 'connected'
    | 'connecting'
    | 'failed'
    | 'idle'
    | 'loading'
    | 'ready';
  tags: never;
}
