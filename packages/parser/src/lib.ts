import path from 'path';

export interface ObjectEvent {
  label: string;
  name: string;
  eventNum: number;
  eventType: number;
}

/**
 * Mapping of GameMaker filenames to their corresponding
 * human-friendly event names.
 */
const objectEvents = [
  { label: 'Create', name: 'Create_0', eventNum: 0, eventType: 0 },
  { label: 'CleanUp', name: 'CleanUp_0', eventNum: 0, eventType: 12 },
  { label: 'Destroy', name: 'Destroy_0', eventNum: 0, eventType: 1 },
  { label: 'Pre-Draw', name: 'Draw_76', eventNum: 76, eventType: 8 },
  { label: 'Draw Begin', name: 'Draw_72', eventNum: 72, eventType: 8 },
  { label: 'Draw', name: 'Draw_0', eventNum: 0, eventType: 8 },
  { label: 'Draw End', name: 'Draw_63', eventNum: 63, eventType: 8 },
  { label: 'Post-Draw', name: 'Draw_77', eventNum: 77, eventType: 8 },
  { label: 'Draw GUI Begin', name: 'Draw_74', eventNum: 74, eventType: 8 },
  { label: 'Draw GUI', name: 'Draw_64', eventNum: 64, eventType: 8 },
  { label: 'Draw GUI End', name: 'Draw_75', eventNum: 75, eventType: 8 },
  { label: 'Begin Step', name: 'Step_1', eventNum: 1, eventType: 3 },
  { label: 'Step', name: 'Step_0', eventNum: 0, eventType: 3 },
  { label: 'End Step', name: 'Step_2', eventNum: 2, eventType: 3 },
  { label: 'Async - HTTP', name: 'Other_62', eventNum: 62, eventType: 7 },
  { label: 'Room End', name: 'Other_5', eventNum: 5, eventType: 7 },
  { label: 'Game End', name: 'Other_3', eventNum: 3, eventType: 7 },
  { label: 'Async - System', name: 'Other_75', eventNum: 75, eventType: 7 },
  { label: 'Animation Update', name: 'Other_58', eventNum: 58, eventType: 7 },
  { label: 'Animation Event', name: 'Other_59', eventNum: 59, eventType: 7 },
  { label: 'Async - Social', name: 'Other_70', eventNum: 70, eventType: 7 },
  { label: 'Async - Save/Load', name: 'Other_72', eventNum: 72, eventType: 7 },
  { label: 'User Event 0', name: 'Other_10', eventNum: 10, eventType: 7 },
  { label: 'Async - Steam', name: 'Other_69', eventNum: 69, eventType: 7 },
  { label: 'Async - Dialog', name: 'Other_63', eventNum: 63, eventType: 7 },
] satisfies ObjectEvent[];
Object.freeze(Object.seal(objectEvents));

/**
 * Given a GameMaker object event filename, get its human-friendly name. */
export function getEventFromFilename(
  filename: string,
): ObjectEvent | undefined {
  const name = path.basename(filename, '.gml');
  return objectEvents.find((x) => x.name === name);
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
