import { StitchError } from './errors';

export type NumbersAfterDecimal = number | ((num: number) => number);

/**
 * Create a number that stringifies with a fixed number
 * of decimal points. Allow different number of decimals
 * for 0/1 and other numbers.
 */
export class NumberFixed extends Number {
  constructor(
    readonly number: any,
    readonly numbersAfterDecimal: NumbersAfterDecimal = 1,
  ) {
    super(number);
    if (isNaN(Number(number))) {
      throw new StitchError(`${number} is not a number`);
    }
  }

  toString() {
    if (typeof this.numbersAfterDecimal === 'number') {
      return this.toFixed(this.numbersAfterDecimal);
    } else {
      // `this` isn't a plain old number, so equality checks
      // will get weird. Force it to be a non-instanced number.
      return this.toFixed(this.numbersAfterDecimal(+this));
    }
  }

  valueOf() {
    return Number(this.number);
  }

  static fromNumberGenerator(numbersAfterDecimal: NumbersAfterDecimal = 1) {
    return (number: number) => {
      return new NumberFixed(number, numbersAfterDecimal);
    };
  }
}
