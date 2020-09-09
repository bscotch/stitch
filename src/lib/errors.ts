import { assert } from "console";

export class Gms2PipelineError extends Error{
  constructor(message:string){
    super(message);
    this.name = "Gms2PipelineError";
    Error.captureStackTrace(this, this.constructor);
  }
}

class Gms2PipelineAssertionError extends Error{
  constructor(message:string){
    super(message);
    this.name = "Gms2PipelineAssertionError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export function assert(claim:any, message:string){
  if(!claim){
    throw new Gms2PipelineAssertionError(message);
  }
}