// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true;
  internalEvents: {
    'done.invoke.addFromFolder.pickingFolder:invocation[0]': {
      type: 'done.invoke.addFromFolder.pickingFolder:invocation[0]';
      data: unknown;
      __tip: 'See the XState TS docs to learn how to strongly type this.';
    };
    'error.platform.addFromFolder.pickingFolder:invocation[0]': {
      type: 'error.platform.addFromFolder.pickingFolder:invocation[0]';
      data: unknown;
    };
    'error.platform.addFromFolder.searchingFolder:invocation[0]': {
      type: 'error.platform.addFromFolder.searchingFolder:invocation[0]';
      data: unknown;
    };
    'xstate.init': { type: 'xstate.init' };
  };
  invokeSrcNameMap: {
    addFromDirectory: 'done.invoke.addFromFolder.searchingFolder:invocation[0]';
    pickDirectory: 'done.invoke.addFromFolder.pickingFolder:invocation[0]';
  };
  missingImplementations: {
    actions: never;
    services: never;
    guards: never;
    delays: never;
  };
  eventsCausingActions: {
    notifyInProgress: 'chooseFolder';
    showError:
      | 'error.platform.addFromFolder.pickingFolder:invocation[0]'
      | 'error.platform.addFromFolder.searchingFolder:invocation[0]';
    storeFolder: 'done.invoke.addFromFolder.pickingFolder:invocation[0]';
  };
  eventsCausingServices: {
    addFromDirectory: 'done.invoke.addFromFolder.pickingFolder:invocation[0]';
    pickDirectory: 'chooseFolder';
  };
  eventsCausingGuards: {};
  eventsCausingDelays: {};
  matchesStates: 'idle' | 'pickingFolder' | 'searchingFolder';
  tags: never;
}
