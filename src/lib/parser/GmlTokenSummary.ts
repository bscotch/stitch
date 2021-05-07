import type { Gms2Project } from '@/Gms2Project';
import { GmlTokenReferenceOptions } from './codeParser';
import type { GmlToken } from './GmlToken';
import { GmlTokenVersioned } from './GmlTokenVersioned';

/** Information about a GML token, including where its references are. */
export class GmlTokenSummary<Token extends GmlToken = GmlToken> {
  private _references: GmlTokenVersioned[] = [];
  constructor(
    readonly token: Token,
    private project: Gms2Project,
    options?: GmlTokenReferenceOptions,
  ) {
    this._references = [
      ...this.findRefsInScripts(options),
      ...this.findRefsInObjects(options),
    ];
  }

  get references() {
    return [...this._references];
  }

  private findRefsInScripts(options?: GmlTokenReferenceOptions) {
    const refs: GmlTokenVersioned[] = [];
    this.project.resources.scripts.forEach((script) => {
      refs.push(
        ...script.findTokenReferences(this.token, {
          suffix: options?.versionSuffix,
        }),
      );
    });
    return refs;
  }

  private findRefsInObjects(options?: GmlTokenReferenceOptions) {
    const refs: GmlTokenVersioned[] = [];
    this.project.resources.objects.forEach((object) => {
      refs.push(
        ...object.findTokenReferences(this.token, {
          suffix: options?.versionSuffix,
        }),
      );
    });
    return refs;
  }

  toJSON() {
    return {
      token: this.token,
      references: this.references,
    };
  }
}
