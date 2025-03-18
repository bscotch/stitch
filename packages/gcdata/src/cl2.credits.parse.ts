import type { CreditsUpdateResult } from './cl2.credits.types.js';
import type { GameChanger } from './GameChanger.js';

export function parseStringifiedCredits(
  text: string,
  packed: GameChanger,
  options: {
    checkSpelling?: boolean;
  } = {},
): CreditsUpdateResult {
  throw new Error('Not implemented');
}

export async function updateChangesFromParsedCredits(
  parsed: CreditsUpdateResult['parsed'],
  moteId: string,
  packed: GameChanger,
): Promise<void> {}
