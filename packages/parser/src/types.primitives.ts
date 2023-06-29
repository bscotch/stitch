/** Base types, like Array, Real, Struct, etc */
export type BaseName = (typeof baseNames)[number];
export const baseNames = [
  'Array',
  'Bool',
  'Function',
  'Pointer',
  'Real',
  'String',
  'Struct',
  'Undefined',
] as const;
Object.freeze(Object.seal(baseNames));

export type PrimitiveName = (typeof primitiveNames)[number];
export const primitiveNames = [
  ...baseNames,
  'Any',
  'Mixed',
  'Asset.GMAnimCurve',
  'Asset.GMAudioGroup',
  'Asset.GMFont',
  'Asset.GMObject',
  'Asset.GMParticleSystem',
  'Asset.GMPath',
  'Asset.GMRoom',
  'Asset.GMScript',
  'Asset.GMSequence',
  'Asset.GMShader',
  'Asset.GMSound',
  'Asset.GMSprite',
  'Asset.GMTileSet',
  'Asset.GMTimeline',
  'Asset.Script',
  'Enum',
  'Id.AudioEmitter',
  'Id.AudioListener',
  'Id.AudioSyncGroup',
  'Id.BackgroundElement',
  'Id.BinaryFile',
  'Id.Buffer',
  'Id.Camera',
  'Id.DsGrid',
  'Id.DsList',
  'Id.DsMap',
  'Id.DsPriority',
  'Id.DsQueue',
  'Id.DsStack',
  'Id.ExternalCall',
  'Id.Gif',
  'Id.Instance',
  'Id.Layer',
  'Id.MpGrid',
  'Id.ParticleEmitter',
  'Id.ParticleSystem',
  'Id.ParticleType',
  'Id.PhysicsIndex',
  'Id.PhysicsParticleGroup',
  'Id.Sampler',
  'Id.SequenceElement',
  'Id.Socket',
  'Id.Sound',
  'Id.SpriteElement',
  'Id.Surface',
  'Id.TextFile',
  'Id.Texture',
  'Id.TileElementId',
  'Id.TileMapElement',
  'Id.TimeSource',
  'Id.Uniform',
  'Id.VertexBuffer',
  'Id.VertexFormat',
] as const;
Object.freeze(Object.seal(primitiveNames));

export type WithableTypeName = (typeof withableTypeNames)[number];
export const withableTypeNames = [
  'Any',
  'Id.Instance',
  'Asset.GMObject',
  'Struct',
] as const;
Object.freeze(Object.seal(withableTypeNames));

export type ContainerTypeName = (typeof containerTypeNames)[number];
export const containerTypeNames = [
  'Id.DsGrid',
  'Id.DsList',
  'Id.DsMap',
  'Id.DsPriority',
  'Id.DsQueue',
  'Id.DsStack',
  'Struct',
  'Array',
] as const;
Object.freeze(Object.seal(containerTypeNames));
