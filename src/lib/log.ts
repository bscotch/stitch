import chalk from "chalk";

export function logError(message:string){
  console.error(chalk.bold.redBright("ERROR:"),chalk.yellow(message));
}

export function logInfo(message:string){
  console.log('   ',chalk.gray(message));
}
