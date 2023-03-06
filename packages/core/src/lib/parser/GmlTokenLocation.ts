import { assert } from '../../utility/errors.js';
import path from '../../utility/paths.js';
import type { Gms2ResourceBase } from '../components/resources/Gms2ResourceBase.js';

export class GmlTokenLocation<
  Resource extends Gms2ResourceBase = Gms2ResourceBase,
> {
  private _resource?: Resource;
  constructor(
    readonly position: number,
    readonly line: number,
    readonly column: number,
    readonly subresource?: string,
  ) {}

  set resource(resource: Resource | undefined) {
    this._resource = resource;
  }
  get resource() {
    return this._resource;
  }
  get filename() {
    assert(this.resource, 'Location is not associated witha resource');
    return `${this.subresource || this.resource.name}.gml`;
  }
  get filepathRelative() {
    return path.join(this.resource!.yyDirRelative, this.filename);
  }
  get filepathAbsolute() {
    return path.join(this.resource!.yyDirAbsolute, this.filename);
  }

  /**
   * Whether this token exactly matches another token
   * by location, including associated resources.
   * Will return false if either token does not have an associated resource.
   */
  isSameLocation(otherLocation: GmlTokenLocation) {
    return (
      this.isSamePosition(otherLocation) &&
      this.isFromSameResource(otherLocation)
    );
  }

  /**
   * Whether or not the token's position data (position, column, line)
   * are the same as another token *ignoring whether they come from the same resource*.
   * This is useful for tokens created externally that do not have an associated
   * Gms2Resource.
   */
  isSamePosition(otherLocation: GmlTokenLocation) {
    return (['position', 'column', 'line'] as const).every((posField) => {
      return this[posField] == otherLocation[posField];
    });
  }

  isFromSameResource(otherLocation: GmlTokenLocation) {
    return (
      this.resource &&
      otherLocation.resource &&
      this.resource.name == otherLocation.resource.name &&
      this.subresource == otherLocation.subresource
    );
  }

  toJSON() {
    return {
      position: this.position,
      line: this.line,
      column: this.column,
      resource: this.resource,
      subresource: this.subresource,
    };
  }

  static createFromMatch(
    source: string,
    match: RegExpExecArray,
    options?: {
      offsetPosition?: number;
      sublocation?: string;
    },
  ) {
    const position = (match.index as number) + (options?.offsetPosition || 0);
    const lines = source.slice(0, position).split(/\r?\n/g);
    return new GmlTokenLocation(
      position,
      lines.length - 1,
      lines[lines.length - 1].length,
      options?.sublocation,
    );
  }
}
