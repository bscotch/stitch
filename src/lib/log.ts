import chalk from "chalk";

export function logError(message:string){
  console.error(chalk.gray('[GMS2]'),chalk.bold.redBright("ERROR:"),chalk.yellow(message));
}

export function logInfo(message:string){
  console.log(chalk.gray('[GMS2]'),chalk.gray(message));
}

export function logWarning(message:string){
  console.log(chalk.gray('[GMS2]'),chalk.bold.yellow("WARNING:"),chalk.yellow(message));
}