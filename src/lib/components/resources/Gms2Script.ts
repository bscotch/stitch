import { findOuterFunctions, GmlFunction } from '@/codeParser';
import { YyScript } from 'types/Yy';
import { Gms2Storage } from '@/Gms2Storage';
import paths from '@/paths';
import {
  Gms2ResourceBase,
  Gms2ResourceBaseParameters,
} from './Gms2ResourceBase';
import { RequiredBy } from '@bscotch/utility';

export class Gms2Script extends Gms2ResourceBase {
  protected yyData!: YyScript; // Happens in the super() constructor
  private codeCache: string | undefined;

  constructor(...setup: Gms2ResourceBaseParameters) {
    super('scripts', ...setup);
  }

  protected createYyFile() {
    const yyData: YyScript = {
      name: this.name,
      tags: [],
      parent: Gms2Script.parentDefault,
      resourceVersion: '1.0',
      resourceType: 'GMScript',
      isDnD: false,
      isCompatibility: false,
    };
    this.storage.writeJson(this.yyPathAbsolute, yyData);
  }

  get codeFilePathAbsolute() {
    return paths.join(this.yyDirAbsolute, `${this.name}.gml`);
  }

  set code(code: string) {
    this.codeCache = code;
    this.storage.writeBlob(this.codeFilePathAbsolute, this.codeCache, '\r\n');
  }

  get code() {
    this.codeCache ??= this.storage
      .readBlob(this.codeFilePathAbsolute)
      .toString();
    return this.codeCache;
  }

  /**
   * Get all functions defined in this script that will be globally available.
   * (Only returns outer-scope named functions.)
   */
  get globalFunctions() {
    const funcs = findOuterFunctions(this.code);
    funcs.forEach((f) => {
      f.location.resource = {
        name: this.name,
        type: 'scripts',
      };
    });
    return funcs;
  }

  static create(name: string, code: string, storage: Gms2Storage) {
    const script = new Gms2Script(name, storage, true);
    script.code = code;
    return script;
  }
}
