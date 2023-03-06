import { goto } from '$app/navigation';
import { derived, get, writable } from 'svelte/store';
import { trpc, type ProjectSummary, type State } from './api.js';
import { generateTrpcStartStopNotifier } from './store.subscribe.js';
import { sortByField } from './util/sort.js';

export { alerts } from './store.alerts.js';

async function createProjectsStore() {
  async function loadProjects() {
    const projects = await trpc.listProjects.query();
    return sortByField(projects, 'name');
  }
  const startStop = generateTrpcStartStopNotifier('onProjectsChanged', {
    transform: (projects) => sortByField(projects as ProjectSummary[], 'name'),
  });
  const { subscribe, update } = writable(await loadProjects(), startStop);
  return {
    subscribe,
    async reloadProjects() {
      const projects = await loadProjects();
      update((state) => {
        state = projects;
        return state;
      });
    },
    async addFromDirectory(directory: string) {
      const output = await trpc.addProjectsFromDirectory.mutate({ directory });
      return output.added;
    },
    async removeById(projectId: string) {
      await trpc.removeProject.mutate({ projectId });
      state.update('currentProjectId', projectId);
    },
  };
}

export const projects = await createProjectsStore();

async function createStateStore() {
  async function loadState() {
    const state = await trpc.getState.query();
    state.gameMakerReleasesUnreadAfter ||= new Date(
      Date.now() - 1000 * 60 * 60 * 24 * 28,
    ).toISOString();
    return state;
  }
  const { subscribe, update } = writable<State>(await loadState());
  return {
    subscribe,
    update<T extends keyof State>(field: T, value: State[T]) {
      if (field === 'currentProjectId') {
        value = (get(projects).find((p) => p.id === value)?.id || null) as any;
        if (!value) {
          goto('/');
        }
      }
      update((current) => {
        current[field] = value;
        return current;
      });
      void trpc.patchState.mutate({ [field]: value });
    },
  };
}

export const state = await createStateStore();

export const currentProjectId = derived(
  [state],
  ([$state]) => $state.currentProjectId,
);

export const currentProject = derived(
  [state, projects],
  ([$state, $projects]) => {
    if (!$state.currentProjectId) {
      return;
    }
    return $projects.find((p) => p.id === $state.currentProjectId);
  },
);

// async function createGameMakerStore() {
//   const { subscribe, set } = writable(await trpc.listGameMakerVersions.query());
//   return {
//     subscribe,
//     async reload() {
//       set(await trpc.listGameMakerVersions.query());
//     },
//   };
// }

// export const gameMakerVersions = await createGameMakerStore();
