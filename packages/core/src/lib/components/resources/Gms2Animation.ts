import {
  Gms2ResourceBase,
  Gms2ResourceBaseParameters,
} from './Gms2ResourceBase.js';

export class Gms2Animation extends Gms2ResourceBase {
  constructor(...setup: Gms2ResourceBaseParameters) {
    super('animcurves', ...setup);
  }
}
