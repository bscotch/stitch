export interface Constructable<Class>{
  new (...args:any[]): Class
}
