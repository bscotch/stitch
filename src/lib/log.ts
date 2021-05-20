import chalk from 'chalk';

const PREFIX = 'STITCH';

function getTimestamp() {
  const now = new Date();
  const hour = `${now.getHours()}`.padStart(2, '0');
  const minute = `${now.getMinutes()}`.padStart(2, '0');
  const seconds = `${now.getSeconds()}`.padStart(2, '0');
  return chalk.gray(`${hour}:${minute}:${seconds}`);
}

export function logError(message: string) {
  console.error(
    chalk.gray(PREFIX),
    chalk.bold.redBright('ERROR'),
    getTimestamp(),
    message,
  );
}

export function logInfo(message: string) {
  console.log(
    chalk.gray(PREFIX),
    chalk.bold.green('INFO'),
    getTimestamp(),
    message,
  );
}

export function logWarning(message: string) {
  console.log(
    chalk.gray(PREFIX),
    chalk.bold.yellow('WARNING'),
    getTimestamp(),
    message,
  );
}

export function logDebug(message: string) {
  if (process.env.DEBUG == 'true') {
    console.log(
      chalk.gray(PREFIX),
      chalk.bold.green('DEBUG'),
      getTimestamp(),
      message,
    );
  }
}
