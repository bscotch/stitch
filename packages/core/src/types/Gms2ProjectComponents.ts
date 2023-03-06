import {
  Yyp,
  YypAudioGroup,
  YypOption,
  YypRoomOrderNode,
  YypTextureGroup,
} from '@bscotch/yy';
import type { Gms2AudioGroup } from '../lib/components/Gms2AudioGroup.js';
import type { Gms2ComponentArray } from '../lib/components/Gms2ComponentArray.js';
import type { Gms2Config } from '../lib/components/Gms2Config.js';
import { Gms2IncludedFileArray } from '../lib/components/Gms2IncludedFileArray.js';
import type { Gms2Option } from '../lib/components/Gms2Option.js';
import { Gms2ResourceArray } from '../lib/components/Gms2ResourceArray.js';
import type { Gms2RoomOrder } from '../lib/components/Gms2RoomOrder.js';
import type { Gms2TextureGroup } from '../lib/components/Gms2TextureGroup.js';
import { Gms2FolderArray } from '../lib/Gms2FolderArray.js';

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

export interface Gms2ProjectComponents extends Omit<Yyp, ReplacedFields> {
  Options: Gms2ComponentArray<YypOption, typeof Gms2Option>;
  configs: Gms2Config;
  Folders: Gms2FolderArray;
  RoomOrderNodes: Gms2ComponentArray<YypRoomOrderNode, typeof Gms2RoomOrder>;
  TextureGroups: Gms2ComponentArray<YypTextureGroup, typeof Gms2TextureGroup>;
  AudioGroups: Gms2ComponentArray<YypAudioGroup, typeof Gms2AudioGroup>;
  IncludedFiles: Gms2IncludedFileArray;
  resources: Gms2ResourceArray;
}
