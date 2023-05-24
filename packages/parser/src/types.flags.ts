export const enum Flag {
  Readable = 1 << 0,
  Writable = 1 << 1,
  Instance = 1 << 2,
  Deprecated = 1 << 3,
  ReadWrite = Readable | Writable,
}

export class Flaggable {
  flags: Flag = Flag.ReadWrite;

  canWrite() {
    return !!(this.flags & Flag.Writable);
  }

  canRead() {
    return !!(this.flags & Flag.Readable);
  }

  isDeprecated() {
    return !!(this.flags & Flag.Deprecated);
  }

  deprecate(deprecated = true): this {
    if (deprecated) {
      this.flags |= Flag.Deprecated;
    } else {
      this.flags &= ~Flag.Deprecated;
    }
    return this;
  }

  /** Set the Writeable flag to false */
  writable(writable: boolean): this {
    if (writable) {
      this.flags |= Flag.Writable;
    } else {
      this.flags &= ~Flag.Writable;
    }
    return this;
  }
}
