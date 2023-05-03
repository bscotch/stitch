import path from 'path';

/**
 * Mapping of GameMaker filenames to their corresponding
 * human-friendly event names.
 */
export const objectEvents = {
  Create_0: 'Create',
  CleanUp_0: 'CleanUp',
  Destroy_0: 'Destroy',

  Draw_76: 'Pre-Draw',
  Draw_72: 'Draw Begin',
  Draw_0: 'Draw',
  Draw_63: 'Draw End',
  Draw_77: 'Post-Draw',
  Draw_74: 'Draw GUI Begin',
  Draw_64: 'Draw GUI',
  Draw_75: 'Draw GUI End',

  Step_1: 'Begin Step',
  Step_0: 'Step',
  Step_2: 'End Step',

  Other_62: 'Async - HTTP',
  Other_5: 'Room End',
  Other_3: 'Game End',
  Other_75: 'Async - System',
  Other_58: 'Animation Update',
  Other_59: 'Animation Event',
  Other_70: 'Async - Social',
  Other_72: 'Async - Save/Load',
  Other_10: 'User Event 0',
  Other_69: 'Async - Steam',
  Other_63: 'Async - Dialog',
} as const;
Object.freeze(Object.seal(objectEvents));

/**
 * Given a GameMaker object event filename, get its human-friendly name. */
export function getEventName(filename: string): string {
  const name = path.basename(filename, '.gml');
  return (objectEvents as any)[name] ?? name;
}

// --------

// Function arguments
// - Should be able to trigger with Ctrl+Shift+Space
// - Try to place this info in the bottom bar the same way GameMaker does
