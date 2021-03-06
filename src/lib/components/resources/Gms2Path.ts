import { YyBase } from '../../../types/Yy';
import {
  Gms2ResourceBase,
  Gms2ResourceBaseParameters,
} from './Gms2ResourceBase';

export class Gms2Path extends Gms2ResourceBase {
  protected yyData!: YyBase; // Happens in the super() constructor

  constructor(...setup: Gms2ResourceBaseParameters) {
    super('paths', ...setup);
  }
}
