import { assert, decodeFromBase64JsonString } from '@bscotch/utility';
import {
  GameMakerUserData,
  gameMakerUserTokenPayloadSchema,
} from './GameMakerLauncher.types.js';

export class GameMakerUser {
  constructor(protected data: GameMakerUserData) {}

  get isLoggedIn() {
    return (
      this.refreshToken &&
      this.accessToken &&
      !GameMakerUser.tokenIsExpired(this.accessToken)
    );
  }

  get accessToken() {
    return this.data.accessToken;
  }

  get refreshToken() {
    return this.data.refreshToken;
  }

  get userEmail() {
    return this.data.login;
  }

  /**
   * The 'name' part of the user email, used to
   * construct the local username and directory.
   */
  get userName() {
    return this.userEmail?.split('@')[0];
  }

  get userId() {
    return this.data.userID;
  }

  /**
   * The APPDATA directory contains a folder for
   * each user, with the basename `${userName}_${userId}`.
   * That is the value provided by this getter.
   * It can be used to specify the user directory for
   * Igor commands.
   */
  get directoryBasename() {
    assert(this.userName && this.userId, 'No user is logged in');
    return `${this.userName}_${this.userId}`;
  }

  toJSON() {
    return this.data;
  }

  protected static tokenIsExpired(tokenString: string) {
    const { exp } = GameMakerUser.parseToken(tokenString);
    return exp * 1000 < Date.now();
  }

  protected static parseToken(tokenString: string) {
    const [, encodedPayload] = tokenString.split('.');
    const payload = gameMakerUserTokenPayloadSchema.parse(
      decodeFromBase64JsonString(encodedPayload),
    );
    return payload;
  }
}
