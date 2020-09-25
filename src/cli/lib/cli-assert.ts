import fs from '../../lib/files';

class Gms2PipelineCLIAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Gms2PipelineCLIAssertionError";
    Error.captureStackTrace(this, this.constructor);
  }
}

function assert(claim: any, message: string) {
  if (!claim) {
    throw new Gms2PipelineCLIAssertionError(message);
  }
}

function getTruthyArg(...args:any[]){
  const truthyArgs:string[] = [] ;
  args.forEach(arg=>{
    if(arg){
      truthyArgs.push(arg);
    }
  });
  return truthyArgs;
}


function assertMutualExclusion(...args:any[]){
  const truthyArgs = getTruthyArg(...args);
  assert(truthyArgs.length <= 1, `Cannot accept these mutually exclusive inputs: ${truthyArgs}`);
}

function assertAtLeastOneTruthy(...args:any[]){
  const truthyArgs = getTruthyArg(...args);
  assert(truthyArgs.length >= 1, `Must have one non-empty inputs.`);
}

function assertPathExists(...args:any[]){
  args.forEach(arg=>{
    assert(fs.existsSync(arg), `The given path does not exists at: ${arg}`);
  });
}

export default{
  assertMutualExclusion,
  assertAtLeastOneTruthy,
  assertPathExists,
  Gms2PipelineCLIAssertionError,
  assert
};