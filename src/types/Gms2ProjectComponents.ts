import {YypComponents} from "./YypComponents";
import type {Gms2ProjectOption} from "../lib/components/Gms2ProjectOption";
import type { Gms2ProjectConfig } from "../lib/components/Gms2ProjectConfig";
import { Gms2ProjectFolder } from "../lib/components/Gms2ProjectFolder";
import { Gms2ProjectRoomOrder } from "../lib/components/Gms2ProjectRoomOrder";

// Convert over to new interface by extending
// YypComponents, omitting each field as we
// convert it into class instances.

type ReplacedFields = "Options"|"configs"|"Folders"|"RoomOrder" ;

export interface Gms2ProjectComponents extends Omit<YypComponents,ReplacedFields> {
  Options: Gms2ProjectOption[],
  configs: Gms2ProjectConfig,
  Folders: Gms2ProjectFolder[],
  RoomOrder: Gms2ProjectRoomOrder[]
}