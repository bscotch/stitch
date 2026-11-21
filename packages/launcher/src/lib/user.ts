import { readJson } from './fsUtil.ts';

/** The user dir GameMaker uses while logged out */
export const loggedOutUserDirName = 'unknownUser_unknownUserID';

/**
 * Compute the per-user dir name from the contents of `um.json`:
 * `<login before '@'>_<userID>`. Only the `login` and `userID` fields are
 * used; `um.json` also contains tokens, which are never read or logged.
 *
 * Returns `undefined` when logged out (newer IDEs drop those fields).
 */
export function userDirNameFromUserInfo(info: unknown): string | undefined {
  if (!info || typeof info !== 'object') return;
  const { login, userID } = info as { login?: unknown; userID?: unknown };
  if (typeof login !== 'string' || !login) return;
  if (typeof userID !== 'string' && typeof userID !== 'number') return;
  const localPart = login.split('@')[0];
  if (!localPart || !String(userID)) return;
  return `${localPart}_${userID}`;
}

export interface ActiveUserDir {
  /** The full path to the user's dir */
  dir: string;
  loggedIn: boolean;
}

/**
 * Find the active user's dir inside a GameMaker user root (e.g.
 * `%APPDATA%/GameMakerStudio2-Beta`), falling back to the logged-out dir.
 */
export async function findActiveUserDir(
  userRoot: string,
  join: (...parts: string[]) => string,
): Promise<ActiveUserDir> {
  const name = userDirNameFromUserInfo(
    await readJson(join(userRoot, 'um.json')),
  );
  return name
    ? { dir: join(userRoot, name), loggedIn: true }
    : { dir: join(userRoot, loggedOutUserDirName), loggedIn: false };
}
