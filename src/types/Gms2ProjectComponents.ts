import {
  YypAudioGroup,
  YypComponents,
  YypComponentsLegacy,
  YypOption,
  YypRoomOrder,
  YypTextureGroup,
} from './Yyp';
import type { Gms2Option } from '../lib/components/Gms2Option';
import type { Gms2Config } from '../lib/components/Gms2Config';
import type { Gms2RoomOrder } from '../lib/components/Gms2RoomOrder';
import type { Gms2TextureGroup } from '../lib/components/Gms2TextureGroup';
import type { Gms2AudioGroup } from '../lib/components/Gms2AudioGroup';
import type { Gms2ComponentArray } from '../lib/components/Gms2ComponentArray';
import { Gms2ResourceArray } from '../lib/components/Gms2ResourceArray';
import { Gms2FolderArray } from '../lib/Gms2FolderArray';
import { Gms2IncludedFileArray } from '../lib/components/Gms2IncludedFileArray';

// Convert over to new interface by extending
// YypComponents, omitting each field as we
// convert it into class instances.

type ReplacedFields =
  | 'Options'
  | 'configs'
  | 'Folders'
  | 'RoomOrder'
  | 'RoomOrderNodes'
  | 'TextureGroups'
  | 'AudioGroups'
  | 'IncludedFiles'
  | 'resources';

export interface Gms2ProjectComponents
  extends Omit<YypComponents | YypComponentsLegacy, ReplacedFields> {
  Options: Gms2ComponentArray<YypOption, typeof Gms2Option>;
  configs: Gms2Config;
  Folders: Gms2FolderArray;
  RoomOrder?: Gms2ComponentArray<YypRoomOrder, typeof Gms2RoomOrder>;
  RoomOrderNodes?: Gms2ComponentArray<YypRoomOrder, typeof Gms2RoomOrder>;
  TextureGroups: Gms2ComponentArray<YypTextureGroup, typeof Gms2TextureGroup>;
  AudioGroups: Gms2ComponentArray<YypAudioGroup, typeof Gms2AudioGroup>;
  IncludedFiles: Gms2IncludedFileArray;
  resources: Gms2ResourceArray;
}
