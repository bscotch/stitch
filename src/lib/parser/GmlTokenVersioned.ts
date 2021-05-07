import { GmlToken } from './GmlToken';
import type { GmlTokenLocation } from './GmlTokenLocation';

/**
 * In order to make refactoring GML code easier, in particular when a token
 * (such as a function name) has changed its type such that any references to
 * it need to be examined, having a "versioning" system on tokens can make
 * that possible. For example, renaming a function from 'myFunc' to 'myFunc_v1'
 * when its inputs or outputs have changed allows for easy identification of
 * all cases where the old references to that function have not been updated.
 */

export class GmlTokenVersioned extends GmlToken {
  /**
   * @param expectedName A function reference may refer to an outdated name for some particular function.
   * If so, the `expectedName` is the *current* name of that function, which may deviate
   * from this *reference's* actual name.
   */
  constructor(
    name: string,
    location: GmlTokenLocation,
    readonly expectedName?: string,
  ) {
    super(name, location);
  }

  get isCorrectVersion() {
    return this.expectedName == this.name;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      invalidVersion: !this.isCorrectVersion,
    };
  }
}
