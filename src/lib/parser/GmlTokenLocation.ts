import type { Gms2ResourceBase } from '../components/resources/Gms2ResourceBase';

export class GmlTokenLocation<
  Resource extends Gms2ResourceBase = Gms2ResourceBase
> {
  private _resource?: Resource;
  constructor(
    readonly position: number,
    readonly line: number,
    readonly column: number,
  ) {}

  set resource(resource: Resource | undefined) {
    this._resource = resource;
  }
  get resource() {
    return this._resource;
  }

  isSameLocation(otherLocation: GmlTokenLocation) {
    return (
      this.hasSamePosition(otherLocation) &&
      this.isFromSameResource(otherLocation)
    );
  }

  hasSamePosition(otherLocation: GmlTokenLocation) {
    return (['position', 'column', 'line'] as const).every((posField) => {
      console.log(this[posField], otherLocation[posField]);
      return this[posField] == otherLocation[posField];
    });
  }

  isFromSameResource(otherLocation: GmlTokenLocation) {
    return (
      this.resource &&
      otherLocation.resource &&
      this.resource.name == otherLocation.resource.name
    );
  }

  static createFromMatch(
    source: string,
    match: RegExpMatchArray,
    offsetPosition = 0,
  ) {
    const position = (match.index as number) + offsetPosition;
    const lines = source.slice(0, position).split(/\r?\n/g);
    return new GmlTokenLocation(
      position,
      lines.length - 1,
      lines[lines.length - 1].length,
    );
  }
}
