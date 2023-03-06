import { Pathy, pathy } from '@bscotch/pathy';
import {
  createStringifier,
  isArray,
  isPlainObject,
  StringifierNode,
} from '@bscotch/stringify';
import { dateDifferenceHours, Logger } from '@bscotch/utility';

import color from 'picocolors';
import { pathToFileURL } from 'url';

const prettyStringify = createStringifier({
  skipUndefinedObjectValues: true,
  stringifiers: [
    {
      ifInstanceof: Pathy,
      stringify(node: StringifierNode<Pathy>) {
        const displayCwd = pathy(process.env.DISPLAY_CWD || process.cwd());
        let normalized = node.value.relativeFrom(displayCwd);
        if (normalized.includes(' ')) {
          normalized = pathToFileURL(node.value.absolute).toString();
        }
        return color.magenta(normalized);
      },
    },
    {
      ifInstanceof: Date,
      stringify(node: StringifierNode<Date>) {
        let string = node.value.toISOString();
        if (dateDifferenceHours(new Date(), node.value) < 1) {
          string = `${node.value.getHours()}:${`${node.value.getMinutes()}`.padStart(
            2,
            '0',
          )}.${node.value.getSeconds()}`;
        }
        return color.cyan(string);
      },
    },
    {
      test(node) {
        return (
          (node.parentIsArray || node.parentIsPlainObject) && node.maxIndex
        );
      },
      prefix(node) {
        let prefix = '  '.repeat(node.depth);
        if (node.parentIsPlainObject) {
          prefix += `${node.key}: `;
        }
        if (isArray(node.value) || isPlainObject(node.value)) {
          prefix += '\n';
        }
        return color.gray(prefix);
      },
      suffix(node) {
        if (isArray(node.value) || isPlainObject(node.value)) {
          return '';
        }
        return '\n';
      },
    },
    {
      test(node) {
        return (
          !isPlainObject(node.value) &&
          !isArray(node.value) &&
          node.maxIndex !== 0
        );
      },
      stringify(node) {
        if (node.value instanceof Error) {
          return `${color.red(node.value.name + ': ')} ${node.value.message}`;
        } else if (typeof node.value === 'string') {
          return node.value;
        } else {
          return color.cyan(`${node.value}`);
        }
      },
    },
  ],
});

export const logger = new Logger({
  formatter(level, message, ...content) {
    message =
      level === 'error'
        ? color.red(message)
        : level === 'warn'
        ? color.yellow(message)
        : message;
    if (typeof content != 'undefined') {
      message += '\n' + prettyStringify(content);
    }
    return message;
  },
});

export function debug(message: string, content?: any) {
  return logger.log('debug', message, content);
}

export function info(message: string, content?: any) {
  return logger.log('info', message, content);
}

export function error(message: string, content?: any) {
  return logger.log('error', message, content);
}

export function warn(message: string, content?: any) {
  return logger.log('warn', message, content);
}
