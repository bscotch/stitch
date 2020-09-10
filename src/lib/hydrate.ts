
export function hydrate<PlainObject,TargetClass extends new (object:PlainObject)=>InstanceType<TargetClass>>(plainObject:PlainObject,targetClass:TargetClass){
  return new targetClass(plainObject);
}

export function hydrateArray<PlainObject,TargetClass extends new (object:PlainObject)=>InstanceType<TargetClass>>(plainObjects:PlainObject[],targetClass:TargetClass){
  return plainObjects.map(object=>hydrate(object,targetClass));
}

export function hydrationGenerator<PlainObject,TargetClass extends new (object:PlainObject)=>InstanceType<TargetClass>>(targetClass:TargetClass){
  return (object:PlainObject)=>{
    return new targetClass(object);
  };
}


// TODO: Figure out how to do this with a generic return type

export function dehydrate<PlainObject,FancyObject extends {dehydrated:PlainObject}>(fancyObject:FancyObject){
  return fancyObject.dehydrated;
}

export function dehydrateArray<PlainObject,FancyObject extends {dehydrated:PlainObject}>(fancyObjects:FancyObject[]){
  return fancyObjects.map(object=>dehydrate<PlainObject,FancyObject>(object));
}