import { writable } from 'svelte/store';
import { v4 as createUuid } from 'uuid';
import type { Alert, AlertPartial } from './types.js';

function createAlertStore() {
  function populateAlert(alert: AlertPartial): Alert {
    return {
      id: createUuid(),
      createdAt: new Date(),
      ...alert,
    };
  }

  const { subscribe, update } = writable<Alert[]>([]);
  const store = {
    subscribe,
    dismiss(id: string) {
      update((messages) => {
        return messages.filter((m) => m.id !== id);
      });
    },
    notify(alert: AlertPartial) {
      update((state) => {
        const fullMessage = populateAlert(alert);
        if (alert.ttl) {
          setTimeout(() => {
            this.dismiss(fullMessage.id);
          }, alert.ttl * 1000);
        }
        // Remove anything that has the same ID
        // (allows 'updating' previous messages)
        return [fullMessage, ...state.filter((m) => m.id !== fullMessage.id)];
      });
    },
  };
  return store;
}

export const alerts = createAlertStore();
