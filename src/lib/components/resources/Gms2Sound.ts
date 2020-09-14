import { Gms2Resource } from "../Gms2Resource";
import { YypResource } from "../../../types/YypComponents";


const Gms2SoundYySample = {
  "compression": 0,
  "volume": 0.48,
  "preload": false,
  "bitRate": 128,
  "sampleRate": 44100,
  "type": 0,
  "bitDepth": 1,
  "audioGroupId": {
    "name": "the_audiogroup",
    "path": "audiogroups/the_audiogroup",
  },
  "soundFile": "sound.ogg",
  "duration": 5.05763,
  "parent": {
    "name": "sample_resources",
    "path": "folders/sample_resources.yy",
  },
  "resourceVersion": "1.0",
  "name": "sound",
  "tags": [],
  "resourceType": "GMSound",
};

export type Gms2SoundYy = typeof Gms2SoundYySample;


export class Gms2Sound extends Gms2Resource {
  constructor(data: YypResource) {
    super(data);
  }
}
