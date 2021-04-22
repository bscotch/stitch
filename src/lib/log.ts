import chalk from 'chalk';

const PREFIX = 'STITCH';

export function logError(message: string) {
  console.error(chalk.gray(PREFIX), chalk.bold.redBright('ERROR'), message);
}

export function logInfo(message: string) {
  console.log(chalk.gray(PREFIX), message);
}

export function logWarning(message: string) {
  console.log(chalk.gray(PREFIX), chalk.bold.yellow('WARNING'), message);
}

export function logDebug(message: string) {
  if (process.env.DEBUG == 'true') {
    console.log(chalk.gray(PREFIX), chalk.bold.green('DEBUG'), message);
  }
}
