import { Pathy } from '@bscotch/pathy';
import vscode from 'vscode';

/**
 * Create a drop-in replacement for `console` that will
 * write to both STDI/O and to a VSCode output channel.
 */
export class Logger {
  static outputChannels = new Map<string, vscode.OutputChannel>();

  constructor(readonly channel: string, readonly prefix?: string) {
    if (!Logger.outputChannels.has(channel)) {
      Logger.outputChannels.set(
        channel,
        vscode.window.createOutputChannel(channel, 'stitch-logs'),
      );
    }
  }

  withPrefix(prefix: string) {
    return new Logger(this.channel, prefix);
  }

  get output() {
    return Logger.outputChannels.get(this.channel)!;
  }

  protected emit(type: 'debug' | 'info' | 'warn' | 'error', ...args: any[]) {
    const timestamp = new Date().toISOString().replace(/^.*T(.*)Z$/, '$1');
    args = args.map((arg) => {
      const isObject = arg && typeof arg === 'object';
      if (isObject && 'uri' in arg && 'fsPath' in arg.uri) {
        // Then this is probably a text document
        // convert it to a URI
        arg = arg.uri;
      }
      if (isObject && 'fsPath' in arg) {
        // change arg to a pathy object
        arg = new Pathy(arg.fsPath);
      }
      if (isObject && arg instanceof Pathy) {
        // Log the path relative to the workspace root
        return arg.relativeFrom(
          vscode.workspace.workspaceFolders![0].uri.fsPath,
        );
      }
      if (isObject && arg.toString() === '[object Object]') {
        return JSON.stringify(arg);
      }
      return arg;
    });
    const components = [type.toUpperCase(), timestamp];
    if (this.prefix) {
      components.push(`[${this.prefix}]`);
    }
    components.push(...args);
    this.output.appendLine(components.join(' '));
    console[type](this.channel, ...components);
  }

  log(...args: any[]) {
    this.emit('info', ...args);
  }

  debug(...args: any[]) {
    this.emit('debug', ...args);
  }

  info(...args: any[]) {
    this.emit('info', ...args);
  }

  warn(...args: any[]) {
    this.emit('warn', ...args);
  }

  error(...args: any[]) {
    this.emit('error', ...args);
  }

  dir(obj: any, options?: any) {
    this.output.appendLine(JSON.stringify(obj, null, 2));
    console.dir(obj, options);
  }
}

export const logger = new Logger('Stitch');

export function info(...args: any[]) {
  logger.info(...args);
}

export function warn(...args: any[]) {
  logger.warn(...args);
}

export class Timer {
  start = Date.now();
  restart() {
    this.start = Date.now();
  }
  millis(message: string) {
    info(message, Date.now() - this.start, 'millis');
  }
  seconds(message: string) {
    info(message, (Date.now() - this.start) / 1000, 'seconds');
  }

  static start() {
    const timer = new Timer();
    return timer;
  }
}
