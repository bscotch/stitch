import { GameChanger } from './GameChanger.ts';

/**
 * Many tests require a local Crashlands2 GameChanger install, which only
 * exists on dev machines (not in CI). Pass this as the `skip` option to
 * `describe()` for suites that need that data.
 */
export const skipWithoutCl2Data: string | false =
  (await GameChanger.projectRumpusGameChangerMetadataFile(
    'Crashlands2',
  ).exists())
    ? false
    : 'Local Crashlands2 GameChanger data not found';
