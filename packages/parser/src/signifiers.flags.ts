const signifierFlags = {
  Readable: 1 << 0,
  Writable: 1 << 1,
  ReadWrite: (1 << 0) | (1 << 1),
  Instance: 1 << 2,
  Deprecated: 1 << 3,
  Static: 1 << 4,
  Local: 1 << 5,
  Global: 1 << 6,
  Parameter: 1 << 7,
  Optional: 1 << 8,
  Macro: 1 << 9, // Is a macro
  Asset: 1 << 10, // Is an asset
  Mixin: 1 << 11, // Is a mixin
  Override: 1 << 12, // Is an override for a parent variable
  Definitive: 1 << 13, // Is a definitive variable (defined in a definitiveSelf, such as a constructor or Create event)
};

export class Flags {
  protected flags = signifierFlags.ReadWrite;

  protected setFlag(flag: number, value: boolean) {
    if (value) {
      this.flags |= flag;
    } else {
      this.flags &= ~flag;
    }
  }
  protected getFlag(flag: number) {
    return !!(this.flags & flag);
  }

  get override() {
    return this.getFlag(signifierFlags.Override);
  }
  set override(override: boolean) {
    this.setFlag(signifierFlags.Override, override);
  }

  get definitive() {
    return this.getFlag(signifierFlags.Definitive);
  }
  set definitive(definitive: boolean) {
    this.setFlag(signifierFlags.Definitive, definitive);
  }

  get asset() {
    return this.getFlag(signifierFlags.Asset);
  }
  set asset(asset: boolean) {
    this.setFlag(signifierFlags.Asset, asset);
  }

  get macro() {
    return this.getFlag(signifierFlags.Macro);
  }
  set macro(macro: boolean) {
    this.setFlag(signifierFlags.Macro, macro);
  }

  get optional() {
    return this.getFlag(signifierFlags.Optional);
  }
  set optional(optional: boolean) {
    this.setFlag(signifierFlags.Optional, optional);
  }

  get instance() {
    return this.getFlag(signifierFlags.Instance);
  }
  set instance(instance: boolean) {
    this.setFlag(signifierFlags.Instance, instance);
  }

  get static() {
    return this.getFlag(signifierFlags.Static);
  }
  set static(static_: boolean) {
    this.setFlag(signifierFlags.Static, static_);
  }

  get local() {
    return this.getFlag(signifierFlags.Local);
  }
  set local(local: boolean) {
    this.setFlag(signifierFlags.Local, local);
    this.setFlag(signifierFlags.Global, !local);
  }

  get global() {
    return this.getFlag(signifierFlags.Global);
  }
  set global(global: boolean) {
    this.setFlag(signifierFlags.Local, !global);
    this.setFlag(signifierFlags.Global, global);
  }

  get parameter() {
    return this.getFlag(signifierFlags.Parameter);
  }
  set parameter(parameter: boolean) {
    this.setFlag(signifierFlags.Parameter, parameter);
  }

  get writable() {
    return this.getFlag(signifierFlags.Writable);
  }
  set writable(writable: boolean) {
    this.setFlag(signifierFlags.Writable, writable);
  }

  get readable() {
    return this.getFlag(signifierFlags.Readable);
  }

  get deprecated() {
    return this.getFlag(signifierFlags.Deprecated);
  }
  set deprecated(deprecated: boolean) {
    this.setFlag(signifierFlags.Deprecated, deprecated);
  }

  get mixin() {
    return this.getFlag(signifierFlags.Mixin);
  }
  set mixin(mixin: boolean) {
    this.setFlag(signifierFlags.Mixin, mixin);
  }

  deprecate(deprecated = true): this {
    this.deprecated = deprecated;
    return this;
  }
}
