export function hydrate<
  PlainObject,
  TargetClass extends new (
    object: PlainObject,
    ...args: any
  ) => InstanceType<TargetClass>,
>(
  plainObject: PlainObject,
  targetClass: TargetClass,
  ...constructorArgs: any[]
) {
  return new targetClass(plainObject, ...constructorArgs);
}

export function hydrateArray<
  PlainObject,
  TargetClass extends new (
    object: PlainObject,
    ...args: any
  ) => InstanceType<TargetClass>,
>(
  plainObjects: PlainObject[],
  targetClass: TargetClass,
  ...constructorArgs: any[]
) {
  return plainObjects.map((object) =>
    hydrate(object, targetClass, ...constructorArgs),
  );
}

// TODO: Figure out how to do this with a generic return type

export function dehydrate<
  PlainObject,
  FancyObject extends { toJSON: () => PlainObject },
>(fancyObject: FancyObject) {
  return fancyObject.toJSON();
}

export function dehydrateArray<
  PlainObject,
  FancyObject extends { toJSON: () => PlainObject },
>(fancyObjects: FancyObject[]) {
  return fancyObjects.map((object) =>
    dehydrate<PlainObject, FancyObject>(object),
  );
}
