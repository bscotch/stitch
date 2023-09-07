import Piscina from 'piscina';
import type { ApplySpriteActionOptions } from './SpriteDest.actions.piscina.mjs';
export type { ApplySpriteActionOptions } from './SpriteDest.actions.piscina.mjs';

const piscina = new Piscina({
  // The URL must be a file:// URL
  filename: new URL('./SpriteDest.actions.piscina.mjs', import.meta.url).href,
});

export default async function applySpriteAction({
  projectYypPath,
  action,
}: ApplySpriteActionOptions) {
  return await piscina.run({ projectYypPath, action });
}
