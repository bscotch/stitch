/**
 * @file Dependency-free (and browser-safe) utilities for GameMaker
 * version strings. Also exported via the `@bscotch/yy/version` subpath
 * so that it can be used without loading the rest of this package.
 */

function ok(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export type GameMakerVersionParsed = [
  year: number,
  month: number,
  major: number,
  minor: number,
];

/** Utility class for GameMaker version strings, allowing easy comparison etc */
export class GameMakerVersionString {
  readonly #parsed: GameMakerVersionParsed;

  readonly version: string;

  constructor(version: string) {
    this.version = version;
    this.#parsed = GameMakerVersionString.parse(version);
  }

  /** Get an array of integer values making up the version (returns a cloned array) */
  get parsed(): GameMakerVersionParsed {
    return [...this.#parsed];
  }

  compare(other: GameMakerVersionString | string) {
    return GameMakerVersionString.compare(
      this.version,
      typeof other === 'string' ? other : other.version,
    );
  }

  gt(other: GameMakerVersionString | string) {
    return GameMakerVersionString.gt(this.version, other);
  }

  gte(other: GameMakerVersionString | string) {
    return GameMakerVersionString.gte(this.version, other);
  }

  eq(other: GameMakerVersionString | string) {
    return GameMakerVersionString.eq(this.version, other);
  }

  lt(other: GameMakerVersionString | string) {
    return GameMakerVersionString.lt(this.version, other);
  }

  lte(other: GameMakerVersionString | string) {
    return GameMakerVersionString.lte(this.version, other);
  }

  toString() {
    return this.version;
  }
  toJSON() {
    return this.version;
  }

  static from<T extends string[] | string>(
    versions: T,
  ): T extends string[] ? GameMakerVersionString[] : GameMakerVersionString {
    if (Array.isArray(versions)) {
      return versions.map((v) => new GameMakerVersionString(v)) as any;
    }
    return new GameMakerVersionString(versions as string) as any;
  }

  /**
   * A function that can be used for sorting GameMaker IDE/Runtime version
   * strings, which are in the format "W.X.Y.Z" where W, X, Y, and Z
   * are all integers.
   * Note that comparisons across branches (lts, public, dev, beta)
   * are messy, so mileage will vary for those.
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   */
  static compare(
    a: string | GameMakerVersionString,
    b: string | GameMakerVersionString,
  ): -1 | 0 | 1 {
    const aVersion =
      typeof a === 'string' ? GameMakerVersionString.parse(a) : a.parsed;
    const bVersion =
      typeof b === 'string' ? GameMakerVersionString.parse(b) : b.parsed;
    for (let i = 0; i < 4; i++) {
      let [aPart, bPart] = [aVersion[i], bVersion[i]];
      if (i === 1) {
        // GameMaker adds two zeros to the end of beta-channel versions, so if this entry is >= 100 we want to divide by 100
        if (aPart >= 100) {
          aPart = Math.floor(aPart / 100);
        }
        if (bPart >= 100) {
          bPart = Math.floor(bPart / 100);
        }
      }
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    return 0;
  }

  static gt(
    a: string | GameMakerVersionString,
    b: string | GameMakerVersionString,
  ) {
    return GameMakerVersionString.compare(a, b) > 0;
  }

  static gte(
    a: string | GameMakerVersionString,
    b: string | GameMakerVersionString,
  ) {
    return GameMakerVersionString.compare(a, b) >= 0;
  }

  static eq(
    a: string | GameMakerVersionString,
    b: string | GameMakerVersionString,
  ) {
    return GameMakerVersionString.compare(a, b) === 0;
  }

  static lt(
    a: string | GameMakerVersionString,
    b: string | GameMakerVersionString,
  ) {
    return GameMakerVersionString.compare(a, b) < 0;
  }

  static lte(
    a: string | GameMakerVersionString,
    b: string | GameMakerVersionString,
  ) {
    return GameMakerVersionString.compare(a, b) <= 0;
  }

  static parse(
    version: string,
  ): [year: number, month: number, major: number, minor: number] {
    const parts = version.split('.');
    ok(parts.length === 4, `Invalid GameMaker version string: ${version}`);
    return parts.map((n) => {
      const num = parseInt(n);
      ok(!isNaN(num), `Invalid GameMaker version string: ${version}`);
      return num;
    }) as any;
  }

  /**
   * Compare two versions purely numerically, part by part, without
   * any normalization of the "minor" part.
   *
   * This is the correct comparison for versions *within* a single
   * GameMaker channel (e.g. two Beta versions, or two LTS versions),
   * and for comparing IDE or Runtime builds within the same family
   * (see {@link GameMakerVersionString.family}).
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   */
  static compareRaw(
    a: string | GameMakerVersionString,
    b: string | GameMakerVersionString,
  ): -1 | 0 | 1 {
    const aVersion =
      typeof a === 'string' ? GameMakerVersionString.parse(a) : a.parsed;
    const bVersion =
      typeof b === 'string' ? GameMakerVersionString.parse(b) : b.parsed;
    for (let i = 0; i < 4; i++) {
      if (aVersion[i] < bVersion[i]) return -1;
      if (aVersion[i] > bVersion[i]) return 1;
    }
    return 0;
  }

  /**
   * Normalize a version string into its canonical form, e.g. removing
   * leading zeroes (GameMaker has released `2024.06.2.162`, which is
   * `2024.6.2.162`).
   */
  static normalize(version: string | GameMakerVersionString): string {
    return (
      typeof version === 'string'
        ? GameMakerVersionString.parse(version)
        : version.parsed
    ).join('.');
  }

  /**
   * Get the "family" of a version: the first three parts of the version
   * (`YEAR.MINOR.PATCH`), without the build number. GameMaker IDE and
   * Runtime builds have independent build numbers, but an IDE is only
   * compatible with runtimes in its own family.
   *
   * @example
   * GameMakerVersionString.family('2026.100.0.1199'); // '2026.100.0'
   */
  static family(version: string | GameMakerVersionString): string {
    const parsed =
      typeof version === 'string'
        ? GameMakerVersionString.parse(version)
        : version.parsed;
    return parsed.slice(0, 3).join('.');
  }

  /**
   * Whether a version uses GameMaker's Beta numbering, where the "minor"
   * part is the target stable minor version times 100 (e.g.
   * `2024.1400.x.y` Betas became `2024.14.x.y`).
   */
  static isBetaNumbering(version: string | GameMakerVersionString): boolean {
    const parsed =
      typeof version === 'string'
        ? GameMakerVersionString.parse(version)
        : version.parsed;
    return parsed[0] >= 2022 && parsed[1] >= 100;
  }

  static sort<T extends (string | GameMakerVersionString)[]>(versions: T): T {
    return versions.sort((a, b) =>
      GameMakerVersionString.compare(
        typeof a === 'string' ? a : a.version,
        typeof b === 'string' ? b : b.version,
      ),
    );
  }
}
