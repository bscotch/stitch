import type { NewSoundDefaults, StitchConfig } from './schema.js';

export function isValidSoundName(name: string, config: StitchConfig): boolean {
  const allowedNames = config?.newSoundRules?.allowedNames;
  if (!allowedNames?.length) return true;
  if (allowedNames.some((pattern) => name.match(new RegExp(pattern))))
    return true;
  return false;
}

export function isValidSpriteName(name: string, config: StitchConfig): boolean {
  const allowedNames = config?.newSpriteRules?.allowedNames;
  if (!allowedNames?.length) return true;
  if (allowedNames.some((pattern) => name.match(new RegExp(pattern))))
    return true;
  return false;
}

export function getDefaultsForNewSound(
  name: string,
  config: StitchConfig,
): NewSoundDefaults | undefined {
  const defaults = config?.newSoundRules?.defaults;
  if (!defaults) return;
  const patterns = Object.keys(defaults);
  for (const pattern of patterns) {
    if (name.match(new RegExp(pattern))) {
      return defaults[pattern];
    }
  }
  return {};
}
