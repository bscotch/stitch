/**
 * @file GameMaker writes float (double) fields with a decimal point
 * (e.g. `1.0`) and integer fields without one. Since parsed numbers
 * are plain JavaScript numbers, we need to know which fields are
 * floats in order to write them back out the same way.
 *
 * Nearly all float fields can be identified by name alone. The
 * few names that are floats in some contexts but integers in others
 * are listed separately, along with the contexts where they're floats.
 *
 * These lists come from files saved by the GameMaker IDE
 * (see the `samples` folder), and should be updated when samples
 * from new GameMaker versions reveal new float fields. Missing a
 * field only causes formatting differences (GameMaker reads `1`
 * and `1.0` the same way).
 */

/** Fields that are always floats, wherever they appear */
const floatFields = new Set([
  // Animation curve points
  'th0',
  'th1',
  'tv0',
  'tv1',
  // Fonts
  'size',
  // Objects
  'physicsAngularDamping',
  'physicsDensity',
  'physicsFriction',
  'physicsLinearDamping',
  'physicsRestitution',
  // Particle systems
  'directionIncrease',
  'directionMax',
  'directionMin',
  'directionWiggle',
  'emitDelayMax',
  'emitDelayMin',
  'emitIntervalMax',
  'emitIntervalMin',
  'gravityDirection',
  'gravityForce',
  'headPosition',
  'lifetimeMax',
  'lifetimeMin',
  'orientationIncrease',
  'orientationMax',
  'orientationMin',
  'orientationWiggle',
  'regionH',
  'regionW',
  'regionX',
  'regionY',
  'sizeIncrease',
  'sizeMax',
  'sizeMin',
  'sizeWiggle',
  'speedIncrease',
  'speedMax',
  'speedMin',
  'speedWiggle',
  // Rooms
  'animationFPS',
  'imageSpeed',
  'PhysicsWorldGravityX',
  'PhysicsWorldGravityY',
  'PhysicsWorldPixToMetres',
  'rotation',
  'scaleX',
  'scaleY',
  // Sequences (including those in sprites and particle systems)
  'backdropImageOpacity',
  'backdropXOffset',
  'backdropYOffset',
  'Key',
  'length',
  'Length',
  'playbackSpeed',
  // Sounds
  'duration',
  // Sprites
  'opacity',
  'swfPrecision',
  // Tilesets
  'tileAnimationSpeed',
  // Multiple resource types (sounds, sequences, rooms)
  'volume',
]);

/**
 * Fields that are floats only in some contexts, mapped to those contexts.
 * A context is the `resourceType` of the object containing the field,
 * or, for objects without a `resourceType`, the key of their parent
 * object or array.
 */
const contextualFloatFields: Record<string, readonly string[]> = {
  // Integers in room views
  hspeed: ['GMRBackgroundLayer'],
  vspeed: ['GMRBackgroundLayer'],
  // Integers in font glyphs and room layers
  x: ['GMRInstance', 'physicsShapePoints', 'points', 'visibleRange'],
  y: ['GMRInstance', 'physicsShapePoints', 'points', 'visibleRange'],
};

/**
 * Whether a field is a GameMaker float field.
 *
 * @param resourceType The `resourceType` of the object containing the field, if it has one
 * @param parentKey The key of the parent object/array of the object containing the field
 * @param key The field's key
 */
export function isGameMakerFloatField(
  resourceType: unknown,
  parentKey: string | undefined,
  key: string,
): boolean {
  const floatContexts = contextualFloatFields[key];
  if (!floatContexts) return floatFields.has(key);
  const context = typeof resourceType === 'string' ? resourceType : parentKey;
  return !!context && floatContexts.includes(context);
}
