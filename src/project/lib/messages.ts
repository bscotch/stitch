import chalk from "chalk";
import nodeAssert from "assert";

const {log} = console;

export function error(message:string){
  console.error(chalk.bold.redBright("ERROR:"),chalk.yellow(message));
}

export function startStep(message:string){
  log(' ',chalk.cyan(message));
}

export function info(message:string){
  log('   ',chalk.gray(message));
}

export function endStep(message:string|null){
  log(' ',chalk.blue(message||' complete!'));
}

export function assert(assertion:any,message:string){
  try{
    nodeAssert(assertion,message);
  }
  catch(err){
    console.error(chalk.bold.redBright('ERROR:'),chalk.yellow(message));
    process.exit(1);
  }
}