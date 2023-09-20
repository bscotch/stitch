import { createEventEmitter } from '@bscotch/emitter';

export const projectsEmitter = createEventEmitter<['projectsChanged']>();
