import { StitchError } from './errors';

/**
 * Create a number that stringifies with a fixed number
 * of decimal points.
 */
export class NumberFixed extends Number {
  constructor(readonly number: any, readonly numbersAfterDecimal = 1) {
    super(number);
    if (isNaN(Number(number))) {
      throw new StitchError(`${number} is not a number`);
    }
  }

  toString() {
    return this.toFixed(this.numbersAfterDecimal);
  }

  valueOf() {
    return Number(this.number);
  }

  static fromNumberGenerator(numbersAfterDecimal = 1) {
    return (number: number) => {
      return new NumberFixed(number, numbersAfterDecimal);
    };
  }
}
