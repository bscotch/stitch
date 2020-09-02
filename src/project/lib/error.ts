
export class Gms2ToolsError extends Error {
  constructor(message:string){
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
  get name(){
    return this.constructor.name;
  }
}
