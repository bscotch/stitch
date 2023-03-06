import type { YyScript } from '@bscotch/yy';
import paths from '../../../utility/paths.js';
import {
  findOuterFunctions,
  findTokenReferences,
} from '../../parser/codeParser.js';
import { GmlToken } from '../../parser/GmlToken.js';
import type { StitchProjectComms } from '../../StitchProject.js';
import {
  Gms2ResourceBase,
  Gms2ResourceBaseParameters,
} from './Gms2ResourceBase.js';

export class Gms2Script extends Gms2ResourceBase<YyScript> {
  private codeCache: string | undefined;
  private globalFunctionCache?: GmlToken[];

  constructor(...setup: Gms2ResourceBaseParameters) {
    super('scripts', ...setup);
  }

  get codeFilePathAbsolute() {
    return paths.join(this.yyDirAbsolute, `${this.name}.gml`);
  }

  set code(code: string) {
    this.purgeCaches();
    this.codeCache = code;
    this.storage.writeBlobSync(
      this.codeFilePathAbsolute,
      this.codeCache,
      '\r\n',
    );
  }

  get code() {
    this.codeCache ??= this.storage
      .readBlobSync(this.codeFilePathAbsolute)
      .toString();
    return this.codeCache;
  }

  /**
   * Get all functions defined in this script that will be globally available.
   * (Only returns outer-scope named functions.)
   */
  get globalFunctions() {
    try {
      this.globalFunctionCache ||= findOuterFunctions(this.code, this);
      return this.globalFunctionCache;
    } catch (err) {
      console.log(
        `Failed to lint the gml code in this script resource: ${this.name}`,
      );
      throw err;
    }
  }

  /**
   * Find all references to a token. ⚠ WARNING: does not consider scope or type!
   */
  findTokenReferences(
    token: GmlToken,
    options?: { suffix?: string; includeSelf?: boolean },
  ) {
    return findTokenReferences(this.code, token, {
      resource: this,
      suffixPattern: options?.suffix,
      includeSelf: options?.includeSelf,
    });
  }

  private purgeCaches() {
    this.codeCache = undefined;
    this.globalFunctionCache = undefined;
  }

  static async create(name: string, code: string, comms: StitchProjectComms) {
    const script = new Gms2Script(name, comms);
    await script.replaceYyFile({
      name: script.name,
    });
    script.code = code;
    return script;
  }
}
