import {ResourceType} from "../resources/View";

interface RawResourceValue {
  id: string,
  resourcePath: string,
  resourceType: ResourceType
}

export interface RawResource {
  Key: string,
  Value: RawResourceValue
}

export interface RawYYP {
  resources: RawResource[]
}
