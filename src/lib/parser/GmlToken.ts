import type { GmlTokenLocation } from './GmlTokenLocation';

export class GmlToken {
  constructor(readonly name: string, readonly location: GmlTokenLocation) {}
  isTheSameToken(otherToken: GmlToken) {
    return (
      this.name == otherToken.name &&
      this.location.isSameLocation(otherToken.location)
    );
  }
}
