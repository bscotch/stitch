import Piscina from 'piscina';
import type {
  ApplySpriteActionOptions,
  SpriteDestActionResult,
} from './SpriteDest.actions.piscina.mjs';
export type {
  ApplySpriteActionOptions,
  SpriteDestActionResult,
} from './SpriteDest.actions.piscina.mjs';

const piscina = new Piscina({
  // The URL must be a file:// URL
  filename: new URL('./SpriteDest.actions.piscina.mjs', import.meta.url).href,
});

export async function applySpriteAction({
  projectYypPath,
  action,
}: ApplySpriteActionOptions): Promise<SpriteDestActionResult> {
  return await piscina.run({ projectYypPath, action });
}
