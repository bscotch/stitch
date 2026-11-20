/**
 * @file Manual IDE → Runtime pairing overrides.
 *
 * Runtimes are inferred for each IDE (see `inferRuntime`), which can't be
 * right every time. When the published feed has a wrong pairing, add an
 * entry here mapping the IDE version to the correct Runtime version
 * (e.g. as listed in GameMaker's release notes).
 *
 * Both versions must exist in GameMaker's feeds, or the feed build fails.
 */
export const pairingOverrides: Readonly<Record<string, string>> = {
  // 'IDE VERSION': 'RUNTIME VERSION',

  // The runtime got an update after this IDE was released.
  '2024.11.0.179': '2024.11.0.227',
};
