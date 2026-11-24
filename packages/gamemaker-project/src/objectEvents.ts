/**
 * GameMaker object events: how they are identified in an object's yy file
 * (`eventType` + `eventNum`), the names of their GML files, and
 * human-friendly labels.
 */

export interface ObjectEvent {
  /** Human-friendly name, e.g. `Draw GUI` */
  label: string;
  /** The event's GML file name, without extension, e.g. `Draw_64` */
  name: string;
  eventType: number;
  eventNum: number;
  /** Category, for grouping in UIs */
  group: string;
  /** For collision events, the name of the other object */
  collisionObject?: string;
}

/** The file-name prefix for each yy `eventType` */
export const eventTypeNames = [
  'Create',
  'Destroy',
  'Alarm',
  'Step',
  'Collision',
  'Keyboard',
  'Mouse',
  'Other',
  'Draw',
  'KeyPress',
  'KeyRelease',
  'Trigger',
  'CleanUp',
  'Gesture',
  'PreCreate',
] as const;
export type EventTypeName = (typeof eventTypeNames)[number];

const COLLISION = 4;

function event(
  label: string,
  eventType: number,
  eventNum: number,
  group: string,
): ObjectEvent {
  return {
    label,
    name: `${eventTypeNames[eventType]}_${eventNum}`,
    eventType,
    eventNum,
    group,
  };
}

/**
 * The commonly used events, with labels matching the GameMaker IDE.
 * Events not listed here (e.g. keyboard events) are still supported,
 * with generated labels.
 */
export const objectEvents: readonly ObjectEvent[] = Object.freeze([
  event('Create', 0, 0, 'main'),
  event('Destroy', 1, 0, 'cleanup'),
  event('CleanUp', 12, 0, 'cleanup'),
  event('Room Start', 7, 4, 'other'),
  event('Room End', 7, 5, 'other'),
  event('Game Start', 7, 2, 'other'),
  event('Game End', 7, 3, 'other'),
  event('Pre-Draw', 8, 76, 'draw'),
  event('Draw Begin', 8, 72, 'draw'),
  event('Draw', 8, 0, 'draw'),
  event('Draw End', 8, 73, 'draw'),
  event('Post-Draw', 8, 77, 'draw'),
  event('Draw GUI Begin', 8, 74, 'draw-gui'),
  event('Draw GUI', 8, 64, 'draw-gui'),
  event('Draw GUI End', 8, 75, 'draw-gui'),
  event('Begin Step', 3, 1, 'step'),
  event('Step', 3, 0, 'step'),
  event('End Step', 3, 2, 'step'),
  ...Array.from({ length: 16 }, (_, i) =>
    event(`User Event ${i}`, 7, i + 10, 'user'),
  ),
  event('Outside Room', 7, 0, 'other'),
  event('Intersect Boundary', 7, 1, 'other'),
  event('Animation End', 7, 7, 'other'),
  event('Path Ended', 7, 8, 'other'),
  event('Animation Update', 7, 58, 'animation'),
  event('Animation Event', 7, 59, 'animation'),
  event('Async - Image Loaded', 7, 60, 'async'),
  event('Async - HTTP', 7, 62, 'async'),
  event('Async - Dialog', 7, 63, 'async'),
  event('Async - IAP', 7, 66, 'async'),
  event('Async - Cloud', 7, 67, 'async'),
  event('Async - Networking', 7, 68, 'async'),
  event('Async - Steam', 7, 69, 'async'),
  event('Async - Social', 7, 70, 'async'),
  event('Async - Push Notification', 7, 71, 'async'),
  event('Async - Save/Load', 7, 72, 'async'),
  event('Async - Audio Recording', 7, 73, 'async'),
  event('Async - Audio Playback', 7, 74, 'async'),
  event('Async - System', 7, 75, 'async'),
  event('Broadcast Message', 7, 76, 'broadcast message'),
  event('Global Left Released', 6, 56, 'mouse'),
  event('Global Right Released', 6, 57, 'mouse'),
  event('Global Middle Released', 6, 58, 'mouse'),
  ...Array.from({ length: 12 }, (_, i) => event(`Alarm ${i}`, 2, i, 'alarm')),
]);

const byName = new Map(objectEvents.map((e) => [e.name.toLowerCase(), e]));
const byLabel = new Map(objectEvents.map((e) => [e.label.toLowerCase(), e]));

/**
 * Get the event info for a given yy `eventType`/`eventNum`. Collision events
 * need the name of the other object, since their files are named after it.
 */
export function getEvent(
  eventType: number,
  eventNum: number,
  collisionObject?: string,
): ObjectEvent | undefined {
  if (eventType === COLLISION) {
    if (!collisionObject) return undefined;
    return collisionEvent(collisionObject);
  }
  const typeName = eventTypeNames[eventType];
  if (!typeName) return undefined;
  const name = `${typeName}_${eventNum}`;
  return (
    byName.get(name.toLowerCase()) || {
      label: `${typeName} ${eventNum}`,
      name,
      eventType,
      eventNum,
      group: typeName.toLowerCase(),
    }
  );
}

/** Get the event info from its GML file name (with or without `.gml`) */
export function getEventFromFilename(
  filename: string,
): ObjectEvent | undefined {
  const name = filename.replace(/^.*[/\\]/, '').replace(/\.gml$/i, '');
  const match = name.match(/^(?<type>[a-zA-Z]+)_(?<rest>.+)$/);
  if (!match) return undefined;
  const typeIndex = eventTypeNames.findIndex(
    (t) => t.toLowerCase() === match.groups!.type.toLowerCase(),
  );
  if (typeIndex < 0) return undefined;
  if (typeIndex === COLLISION) return collisionEvent(match.groups!.rest);
  if (!/^\d+$/.test(match.groups!.rest)) return undefined;
  return getEvent(typeIndex, Number(match.groups!.rest));
}

/** Get the event info from its human-friendly label */
export function getEventFromLabel(label: string): ObjectEvent | undefined {
  const collision = label.match(/^Collision \((?<name>.+)\)$/);
  if (collision) return collisionEvent(collision.groups!.name);
  return byLabel.get(label.toLowerCase());
}

function collisionEvent(objectName: string): ObjectEvent {
  return {
    label: `Collision (${objectName})`,
    name: `Collision_${objectName}`,
    eventType: COLLISION,
    eventNum: 0,
    group: 'collision',
    collisionObject: objectName,
  };
}
