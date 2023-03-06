const logLevelColors = {
  debug: 'bgGray',
  info: 'bgGreen',
  warning: 'bgYellow',
  error: 'bgRed',
} as const;

type LogLevel = keyof typeof logLevelColors;
const logLevels = Object.keys(logLevelColors) as LogLevel[];

function log(level: LogLevel, ...stuff: any[]) {
  const minLevel = logLevels.find((l) => l == process.env.LOG_LEVEL) || 'info';
  if (logLevels.indexOf(level) < logLevels.indexOf(minLevel)) {
    return;
  }
  const message = stuff.reduce((msg, item) => {
    const itemAsString =
      typeof item == 'object' ? JSON.stringify(item) : `${item}`;
    if (!itemAsString) {
      return msg;
    }
    if (!msg) {
      return itemAsString;
    }
    return `${msg} ${itemAsString}`;
  }, '');
  return message;
}

export function debug(...stuff: any[]) {
  if (process.env.DEBUG == 'true') {
    return log('debug', ...stuff);
  }
  return;
}

export function info(...stuff: any[]) {
  return log('info', ...stuff);
}

export function error(...stuff: any[]) {
  return log('error', ...stuff);
}

export function warning(...stuff: any[]) {
  return log('warning', ...stuff);
}
