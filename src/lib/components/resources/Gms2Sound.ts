import { Gms2Resource } from "../Gms2Resource";
import { YypResource } from "../../../types/YypComponents";

export class Gms2Sound extends Gms2Resource {
  additionalProperty = '';
  constructor(data: YypResource){
    super(data);
    this.additionalProperty = 'test';
  }
}
