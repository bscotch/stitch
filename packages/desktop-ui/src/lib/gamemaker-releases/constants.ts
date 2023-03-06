import type { GameMakerVersionData } from '../api.js';

export type Channel = typeof channels[number];
export const channels = ['lts', 'stable', 'beta', 'unstable'] as const;

export function releaseAnchorId(release: GameMakerVersionData) {
  return `release-${release.ide.version}`;
}
export function ideAnchorId(release: GameMakerVersionData) {
  return `release-${release.ide.version}-runtime`;
}
export function runtimeAnchorId(release: GameMakerVersionData) {
  return `release-${release.ide.version}-runtime`;
}
