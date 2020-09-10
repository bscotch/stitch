import {YypComponents} from "./YypComponents";
import type {Gms2ProjectOption} from "../lib/components/Gms2ProjectOption";
import type { Gms2ProjectConfig } from "../lib/components/Gms2ProjectConfig";
import { Gms2ProjectFolder } from "../lib/components/Gms2ProjectFolder";
import { Gms2ProjectRoomOrder } from "../lib/components/Gms2ProjectRoomOrder";
import { Gms2ProjectTextureGroup } from "../lib/components/Gms2ProjectTextureGroup";
import { Gms2ProjectAudioGroup } from "../lib/components/Gms2ProjectAudioGroup";
import { Gms2ProjectIncludedFile } from "../lib/components/Gms2ProjectIncludedFile";

// Convert over to new interface by extending
// YypComponents, omitting each field as we
// convert it into class instances.

type ReplacedFields = "Options"|"configs"|"Folders"|"RoomOrder"|"TextureGroups"|"AudioGroups"|"IncludedFiles" ;

export interface Gms2ProjectComponents extends Omit<YypComponents,ReplacedFields> {
  Options: Gms2ProjectOption[],
  configs: Gms2ProjectConfig,
  Folders: Gms2ProjectFolder[],
  RoomOrder: Gms2ProjectRoomOrder[],
  TextureGroups: Gms2ProjectTextureGroup[],
  AudioGroups: Gms2ProjectAudioGroup[],
  IncludedFiles: Gms2ProjectIncludedFile[],
}