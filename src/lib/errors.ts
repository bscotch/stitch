
export class Gms2PipelineError extends Error{
  constructor(message:string){
    super(message);
    this.name = "Gms2PipelineError";
    Error.captureStackTrace(this, this.constructor);
  }
}
