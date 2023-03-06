import type { GmlTokenLocation } from './GmlTokenLocation.js';

export class GmlToken {
  constructor(readonly name: string, readonly location: GmlTokenLocation) {}
  isTheSameToken(otherToken: GmlToken) {
    return (
      this.name == otherToken.name &&
      this.location.isSameLocation(otherToken.location)
    );
  }

  toJSON() {
    return {
      name: this.name,
      location: this.location,
    };
  }
}
