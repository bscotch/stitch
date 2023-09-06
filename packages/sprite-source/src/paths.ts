import { pathy, type Pathy } from '@bscotch/pathy';
import {
  spriteSourceConfigSchema,
  spriteSourceRootSummarySchema,
} from './types.js';

export type SpriteSourcePaths = ReturnType<typeof getSpriteSourcePaths>;

export function getSpriteSourcePaths(spriteSourceDir: string | Pathy) {
  const root = pathy(spriteSourceDir);
  const stitch = root.join('.stitch');
  return {
    root,
    stitch,
    cache: pathy('sprites.info.json', stitch).withValidator(
      spriteSourceRootSummarySchema,
    ),
    config: pathy('sprites.config.json', stitch).withValidator(
      spriteSourceConfigSchema,
    ),
  };
}
