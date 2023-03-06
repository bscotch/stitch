import {
  SoundChannel,
  SoundChannelAsString,
  SoundCompression,
  SoundCompressionAsString,
  SoundSampleRate,
  YySound,
} from '@bscotch/yy';
import { assert } from '../../../utility/errors.js';
import paths from '../../../utility/paths.js';
import type { StitchProjectComms } from '../../StitchProject.js';
import {
  Gms2ResourceBase,
  Gms2ResourceBaseParameters,
} from './Gms2ResourceBase.js';

export class Gms2Sound extends Gms2ResourceBase<YySound> {
  constructor(...setup: Gms2ResourceBaseParameters) {
    super('sounds', ...setup);
  }

  get audioFilePathAbsolute() {
    return paths.join(this.yyDirAbsolute, this.yyData.soundFile);
  }

  set sampleRate(rate: SoundSampleRate) {
    this.yyData.sampleRate = rate;
    this.save();
  }

  set bitRate(rate: number) {
    assert(rate > 8, 'rate must be at least 8');
    assert(rate < 513, 'rate must be no more than 512');
    assert(rate % 8 == 0, 'rate must be a multiple of 8');
    this.yyData.bitRate = rate;
    this.save();
  }

  get channels() {
    return SoundChannel[this.yyData.type] as SoundChannelAsString;
  }

  set channels(channelAsString: SoundChannelAsString) {
    const channel = SoundChannel[channelAsString];
    this.yyData.type = channel;
    this.save();
  }

  channelsAsIndex() {
    return this.yyData.type;
  }

  get compression() {
    return SoundCompression[
      this.yyData.compression
    ] as SoundCompressionAsString;
  }

  set compression(levelAsString: SoundCompressionAsString) {
    const level = SoundCompression[levelAsString];
    this.yyData.compression = level;
    this.save();
  }

  compressionAsIndex() {
    return this.yyData.compression;
  }

  /** Overwrite this Sound's audio file with an external file. */
  replaceAudioFile(externalAudioFilePath: string) {
    const extension = paths.extname(externalAudioFilePath);
    const oldFileName = this.yyData.soundFile;
    const newFileName = `${this.name}${extension}`;
    if (oldFileName != newFileName) {
      this.storage.deleteFileSync(this.audioFilePathAbsolute);
    }
    this.yyData.soundFile = newFileName;
    this.storage.copyFileSync(
      externalAudioFilePath,
      this.audioFilePathAbsolute,
    );
    return this.save();
  }

  get audioGroup() {
    return this.yyData.audioGroupId.name;
  }

  set audioGroup(name: string) {
    this.yyData.audioGroupId.name = name;
    this.yyData.audioGroupId.path = `audiogroups/${name}`;
    this.save();
  }

  static get audioGroupIdDefault() {
    return {
      name: 'audiogroup_default',
      path: 'audiogroups/audiogroup_default',
    };
  }

  /**
   * Given a sound file, create a GameMaker Sound asset with default parameter values.
   * The resource will be named after the source file.
   */
  static async create(
    externalAudioFilePath: string,
    comms: StitchProjectComms,
  ): Promise<Gms2Sound> {
    const { name } = paths.parse(externalAudioFilePath);
    const sound = new Gms2Sound(name, comms);

    await sound.replaceYyFile({
      name: sound.name,
      soundFile: sound.name,
    });
    return sound.replaceAudioFile(externalAudioFilePath);
  }
}
