export const enum Flag {
  Readable = 1 << 0,
  Writable = 1 << 1,
  Instance = 1 << 2,
  Deprecated = 1 << 3,
  Static = 1 << 4,
  Local = 1 << 5,
  Global = 1 << 6,
  Parameter = 1 << 7,
  Native = 1 << 8, // Is a built-in.
  ReadWrite = Readable | Writable,
}

export class Flaggable {
  flags: Flag = Flag.ReadWrite;

  protected setFlag(flag: Flag, value: boolean) {
    if (value) {
      this.flags |= flag;
    } else {
      this.flags &= ~flag;
    }
  }

  get native() {
    return !!(this.flags & Flag.Native);
  }
  set native(native: boolean) {
    this.setFlag(Flag.Native, native);
  }

  get instance() {
    return !!(this.flags & Flag.Instance);
  }
  set instance(instance: boolean) {
    this.setFlag(Flag.Instance, instance);
  }

  get static() {
    return !!(this.flags & Flag.Static);
  }
  set static(static_: boolean) {
    this.setFlag(Flag.Static, static_);
  }

  get local() {
    return !!(this.flags & Flag.Local);
  }
  set local(local: boolean) {
    this.setFlag(Flag.Local, local);
  }

  get global() {
    return !!(this.flags & Flag.Global);
  }
  set global(global: boolean) {
    this.setFlag(Flag.Global, global);
  }

  get parameter() {
    return !!(this.flags & Flag.Parameter);
  }
  set parameter(parameter: boolean) {
    this.setFlag(Flag.Parameter, parameter);
  }

  get writable() {
    return !!(this.flags & Flag.Writable);
  }
  set writable(writable: boolean) {
    this.setFlag(Flag.Writable, writable);
  }

  get readable() {
    return !!(this.flags & Flag.Readable);
  }

  get deprecated() {
    return !!(this.flags & Flag.Deprecated);
  }
  set deprecated(deprecated: boolean) {
    this.setFlag(Flag.Deprecated, deprecated);
  }

  deprecate(deprecated = true): this {
    this.deprecated = deprecated;
    return this;
  }
}
