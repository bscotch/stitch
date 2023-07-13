import path from 'path';
import { logger } from './logger.js';

export interface ObjectEvent {
  label: string;
  name: string;
  eventNum: number;
  eventType: number;
  group: string;
}

export type ObjectEventName = (typeof objectEvents)[number]['name'];
export type ObjectEventLabel = (typeof objectEvents)[number]['label'];

interface ObjectAlarmEvent<N extends number> extends ObjectEvent {
  label: `Alarm ${N}`;
  name: `Alarm_${N}`;
  eventNum: N;
  eventType: 2;
  group: 'alarm';
}

const objectAlarmEvents: ObjectAlarmEvent<number>[] = [];
for (let i = 0; i < 10; i++) {
  objectAlarmEvents.push({
    label: `Alarm ${i}`,
    name: `Alarm_${i}`,
    eventNum: i,
    eventType: 2,
    group: 'alarm',
  });
}

/**
 * Mapping of GameMaker filenames to their corresponding
 * human-friendly event names.
 */
export const objectEvents = [
  {
    label: 'Create',
    name: 'Create_0',
    eventNum: 0,
    eventType: 0,
    group: 'main',
  },
  {
    label: 'Destroy',
    name: 'Destroy_0',
    eventNum: 0,
    eventType: 1,
    group: 'cleanup',
  },
  {
    label: 'CleanUp',
    name: 'CleanUp_0',
    eventNum: 0,
    eventType: 12,
    group: 'cleanup',
  },
  {
    label: 'Room End',
    name: 'Other_5',
    eventNum: 5,
    eventType: 7,
    group: 'cleanup',
  },
  {
    label: 'Game End',
    name: 'Other_3',
    eventNum: 3,
    eventType: 7,
    group: 'cleanup',
  },
  {
    label: 'Pre-Draw',
    name: 'Draw_76',
    eventNum: 76,
    eventType: 8,
    group: 'draw',
  },
  {
    label: 'Draw Begin',
    name: 'Draw_72',
    eventNum: 72,
    eventType: 8,
    group: 'draw',
  },
  {
    label: 'Draw',
    name: 'Draw_0',
    eventNum: 0,
    eventType: 8,
    group: 'draw',
  },
  {
    label: 'Draw End',
    name: 'Draw_63',
    eventNum: 63,
    eventType: 8,
    group: 'draw',
  },
  {
    label: 'Post-Draw',
    name: 'Draw_77',
    eventNum: 77,
    eventType: 8,
    group: 'draw',
  },
  {
    label: 'Draw GUI Begin',
    name: 'Draw_74',
    eventNum: 74,
    eventType: 8,
    group: 'draw-gui',
  },
  {
    label: 'Draw GUI',
    name: 'Draw_64',
    eventNum: 64,
    eventType: 8,
    group: 'draw-gui',
  },
  {
    label: 'Draw GUI End',
    name: 'Draw_75',
    eventNum: 75,
    eventType: 8,
    group: 'draw-gui',
  },
  {
    label: 'Begin Step',
    name: 'Step_1',
    eventNum: 1,
    eventType: 3,
    group: 'step',
  },
  { label: 'Step', name: 'Step_0', eventNum: 0, eventType: 3, group: 'step' },
  {
    label: 'End Step',
    name: 'Step_2',
    eventNum: 2,
    eventType: 3,
    group: 'step',
  },
  {
    label: 'Animation Update',
    name: 'Other_58',
    eventNum: 58,
    eventType: 7,
    group: 'animation',
  },
  {
    label: 'Animation Event',
    name: 'Other_59',
    eventNum: 59,
    eventType: 7,
    group: 'animation',
  },
  {
    label: 'Async - HTTP',
    name: 'Other_62',
    eventNum: 62,
    eventType: 7,
    group: 'async',
  },
  {
    label: 'Async - System',
    name: 'Other_75',
    eventNum: 75,
    eventType: 7,
    group: 'async',
  },
  {
    label: 'Async - Social',
    name: 'Other_70',
    eventNum: 70,
    eventType: 7,
    group: 'async',
  },
  {
    label: 'Async - Save/Load',
    name: 'Other_72',
    eventNum: 72,
    eventType: 7,
    group: 'async',
  },
  {
    label: 'Async - Steam',
    name: 'Other_69',
    eventNum: 69,
    eventType: 7,
    group: 'async',
  },
  {
    label: 'Async - Dialog',
    name: 'Other_63',
    eventNum: 63,
    eventType: 7,
    group: 'async',
  },
  ...objectAlarmEvents,
] as const;
Object.freeze(Object.seal(objectEvents));

/**
 * Given a GameMaker object event filename, get its human-friendly name. */
export function getEventFromFilename(
  filename: string,
): ObjectEvent | undefined {
  const name = path.basename(filename, '.gml');
  const event = objectEvents.find((x) => x.name === name);
  if (!event) {
    logger.warn(`Could not find event for filename: ${filename}`);
  }
  return event;
}

export function getEventFromLabel(label: string): ObjectEvent | undefined {
  return objectEvents.find((x) => x.label === label);
}

export function getEventFrom(
  eventNum: number,
  eventType: number,
): ObjectEvent | undefined {
  return objectEvents.find(
    (x) => x.eventNum === eventNum && x.eventType === eventType,
  );
}
