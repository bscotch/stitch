import { createEventEmitter } from '@bscotch/utility';

export const projectsEmitter = createEventEmitter<['projectsChanged']>();
