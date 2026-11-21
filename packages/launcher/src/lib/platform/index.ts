import { homedir, arch } from 'node:os';
import { linux } from './linux.ts';
import { mac } from './mac.ts';
import type { OsName, PlatformEnv, PlatformLayer } from './types.ts';
import { windows } from './windows.ts';

export type * from './types.ts';

const layers: Record<OsName, PlatformLayer> = { windows, mac, linux };

export function osNameFor(platform: NodeJS.Platform): OsName | undefined {
  return platform === 'win32'
    ? 'windows'
    : platform === 'darwin'
      ? 'mac'
      : platform === 'linux'
        ? 'linux'
        : undefined;
}

/** The platform layer for an OS (default: the current one) */
export function getPlatformLayer(os?: OsName): PlatformLayer {
  const name = os ?? osNameFor(process.platform);
  if (!name) {
    throw new Error(
      `GameMaker is not available on this platform (${process.platform}).`,
    );
  }
  return layers[name];
}

export function currentPlatformEnv(): PlatformEnv {
  return { homedir: homedir(), env: process.env, arch: arch() };
}
