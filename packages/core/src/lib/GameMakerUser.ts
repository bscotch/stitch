import { GameMakerUserData } from './GameMakerEngine.types.js';

export class GameMakerUser {
  constructor(protected data: GameMakerUserData) {}

  get userEmail() {
    return this.data.login;
  }

  /**
   * The 'name' part of the user email, used to
   * construct the local username and directory.
   */
  get userName() {
    return this.userEmail.split('@')[0];
  }

  get userId() {
    return this.data.userID;
  }

  toJSON() {
    return this.data;
  }
}
