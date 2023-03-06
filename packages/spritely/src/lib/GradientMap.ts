import { Color } from './Color.js';
import { assert } from './errors.js';

type Position = { position: number; color: Color };

export class GradientMap {
  private positions: Position[] = [];

  constructor(
    readonly name: string,
    colorMap?: { [position: string]: string },
    private ifNameMatches?: {
      match?: 'subimage' | 'sprite';
      pattern: RegExp;
    }[],
  ) {
    if (colorMap) {
      const positions = Object.keys(colorMap);
      for (const position of positions) {
        this.addPosition(Number(position), colorMap[position]);
      }
    }
  }

  /**
   * If `ifNameMatches` regexes supplied on instancing, can check
   * a given string (e.g. filename) to see if it matches any of those
   * patterns.
   */
  canApplyToImage(spriteName: string, subimageName: string) {
    if (!this.ifNameMatches || !this.ifNameMatches.length) {
      return true;
    }
    return this.ifNameMatches.some((matcher) => {
      if (matcher.match == 'sprite') {
        return spriteName.match(matcher.pattern);
      }
      return subimageName.match(matcher.pattern);
    });
  }

  addPosition(position: number, colorHex: string) {
    GradientMap.assertValidPosition(position);
    const color = new Color(colorHex);
    assert(
      !this.positions.find((pos) => pos.position == position),
      `There already exists a value at position ${position}`,
    );
    this.positions.push({ position, color });
    this.sortPositions();
  }

  getColorAtPosition(position: number) {
    GradientMap.assertValidPosition(position);
    // Find the defined positions that surround this one
    const positions = this.getPositions();
    assert(positions.length > 0, 'There are no gradient positions defined');
    const existingPosition = positions.find((pos) => pos.position == position);
    if (existingPosition) {
      return existingPosition.color;
    }
    if (positions.length == 1 || position < positions[0].position) {
      // Then everything is the same color
      return positions[0].color;
    }
    if (position > positions[positions.length - 1].position) {
      return positions[positions.length - 1].color;
    }
    // Closest defined position on left is the first one that is LESS THAN, from reverse sort
    const reversedPositions = [...positions].reverse();
    const leftPosition = reversedPositions.find(
      (reversedPosition) => reversedPosition.position < position,
    ) as Position;
    const rightPosition = positions.find(
      (pos) => pos.position > position,
    ) as Position;
    // Interpolate between these colors
    const relativePosition =
      (position - leftPosition.position) /
      (rightPosition.position - leftPosition.position);
    const rgba = leftPosition.color.rgba;
    for (let channel = 0; channel < 4; channel++) {
      const colorDiff =
        (rightPosition.color.rgba[channel] - leftPosition.color.rgba[channel]) *
        relativePosition;
      rgba[channel] = Math.floor(rgba[channel] + colorDiff);
    }
    return new Color(rgba);
  }

  /** Get a shallow clone of position data */
  getPositions() {
    return this.positions.map((pos) => {
      return { ...pos };
    });
  }

  static assertValidPosition(position: number) {
    assert(
      position >= 0 && position <= 100,
      `GradientMap positions must be 0-100`,
    );
  }

  private sortPositions() {
    this.positions.sort((a, b) => a.position - b.position);
  }
}
