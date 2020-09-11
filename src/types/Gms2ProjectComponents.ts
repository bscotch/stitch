import { YypComponents } from "./YypComponents";
import type { Gms2Option } from "../lib/components/Gms2Option";
import type { Gms2Config } from "../lib/components/Gms2Config";
import { Gms2Folder } from "../lib/components/Gms2Folder";
import { Gms2RoomOrder } from "../lib/components/Gms2RoomOrder";
import { Gms2TextureGroup } from "../lib/components/Gms2TextureGroup";
import { Gms2AudioGroup } from "../lib/components/Gms2AudioGroup";
import { Gms2IncludedFile } from "../lib/components/Gms2IncludedFile";
import type { Gms2Project } from "../lib/Gms2Project";

// Convert over to new interface by extending
// YypComponents, omitting each field as we
// convert it into class instances.

type ReplacedFields = "Options" | "configs" | "Folders" | "RoomOrder" | "TextureGroups" | "AudioGroups" | "IncludedFiles" | "resources";

export interface Gms2ProjectComponents extends Omit<YypComponents, ReplacedFields> {
  Options: Gms2Option[],
  configs: Gms2Config,
  Folders: Gms2Folder[],
  RoomOrder: Gms2RoomOrder[],
  TextureGroups: Gms2TextureGroup[],
  AudioGroups: Gms2AudioGroup[],
  IncludedFiles: Gms2IncludedFile[],
  resources: Gms2ResourceSubclass[],
}

export type Gms2ResourceSubclass = InstanceType<typeof Gms2Project._resourceClassMap[keyof typeof Gms2Project._resourceClassMap]>
export type Gms2ResourceType = keyof typeof Gms2Project._resourceClassMap;
