import {YypComponents} from "./YypComponents";
import type {Gms2ProjectOption} from "../lib/components/Gms2ProjectOption";
import type { Gms2ProjectConfig } from "../lib/components/Gms2ProjectConfig";


// Convert over to new interface by extending
// YypComponents, omitting each field as we
// convert it into class instances.

export interface Gms2ProjectComponents extends Omit<YypComponents,"Options"|"configs"> {
  Options: Gms2ProjectOption[],
  configs: Gms2ProjectConfig
}

