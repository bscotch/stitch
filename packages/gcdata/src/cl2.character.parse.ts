import { CharacterUpdateResult } from './cl2.character.types.js';
import { GameChanger } from './GameChanger.js';

export function parseStringifiedCharacter(
  text: string,
  packed: GameChanger,
  options: {
    checkSpelling?: boolean;
  } = {},
): CharacterUpdateResult {
  throw new Error('Not implemented');
}

export async function updateChangesFromParsedCharacter(
  parsed: CharacterUpdateResult['parsed'],
  moteId: string,
  packed: GameChanger,
): Promise<never> {
  throw new Error('Not implemented');
}
