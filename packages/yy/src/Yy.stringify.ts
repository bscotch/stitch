import { GameMakerVersionString } from './types/GameMakerVersionString.js';
import type { Yyp, YypResource } from './types/Yyp.js';
import { FixedNumber, nameField, yyIsNewFormat } from './types/utility.js';

const escapable =
  // eslint-disable-next-line no-control-regex, no-misleading-character-class
  /[\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
const meta = {
  // table of character substitutions
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
  '"': '\\"',
  '\\': '\\\\',
};

function quote(string: string) {
  // If the string contains no control characters, no quote characters, and no
  // backslash characters, then we can safely slap some quotes around it.
  // Otherwise we must also replace the offending characters with safe escape
  // sequences.

  escapable.lastIndex = 0;
  return escapable.test(string)
    ? '"' +
        string.replace(escapable, function (a) {
          const c = meta[a as keyof typeof meta];
          return typeof c === 'string'
            ? c
            : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) +
        '"'
    : '"' + string + '"';
}

export type AnyExceptPromise<T> = T extends Promise<any> ? never : T;

/**
 * Jsonify, with GameMaker-like JSON and allowing for BigInts.
 * Based on {@link https://github.com/sidorares/json-bigint/blob/master/lib/stringify.js json-bigint}.
 *
 * The yyp file can be passed in to use as a reference,
 * e.g. to ensure the write format is used for new files.
 */
export function stringifyYy(yyData: any, yyp?: Yyp): string {
  const isNewFormat = yyIsNewFormat(yyData) || yyIsNewFormat(yyp);

  const eol = isNewFormat ? '\n' : `\r\n`;

  let gap = '';
  let level = 0; // Level 1 are root elements
  const indent = '  ';
  type Pointer = (string | number)[];
  let arrayLevel = 0;

  yyData = prepareForStringification(yyData, yyp);

  /**
   * Recursively JSON-stringify
   */
  function stringify(key: number, holder: any[], pointer: Pointer): string;
  function stringify(
    key: string,
    holder: { [key: string]: string },
    pointer: Pointer,
  ): string;
  function stringify(key: number | string, holder: any, pointer: Pointer = []) {
    // Produce a string from holder[key].
    let value = holder[key];
    if (key !== '') {
      pointer.push(key);
    }

    const mind = gap;
    const startingLevel = level;

    if (value instanceof FixedNumber) {
      return value.toFixed(value.digits);
    }

    // If the value has a toJSON method, call it to obtain a replacement value.
    value = value?.toJSON?.(key) ?? value;

    // What happens next depends on the value's type.
    switch (typeof value) {
      case 'string':
        return quote(value);

      case 'number':
      case 'boolean':
      case 'bigint':
        // If the value is a boolean or null, convert it to a string. Note:
        // typeof null does not produce 'null'. The case is included here in
        // the remote chance that this gets fixed someday.

        return String(value);

      // If the type is 'object', we might be dealing with an object or an array or
      // null.

      case 'object': {
        // Due to a specification blunder in ECMAScript, typeof null is 'object',
        // so watch out for that case.

        if (!value) {
          return 'null';
        }

        // Make an array to hold the partial results of stringifying this object value.

        gap += indent;
        level++;

        // Is the value an array?

        if (Array.isArray(value)) {
          // Stringify every element. Use null as a placeholder
          // for non-JSON values.
          arrayLevel++;

          const jsonifiedValues = value.map(
            (_, i) => stringify(i, value, [...pointer]) || 'null',
          );

          // Join all of the elements together, separated with commas, and wrap them in
          // brackets.
          const v =
            jsonifiedValues.length === 0
              ? '[]'
              : `[${eol}` +
                gap +
                jsonifiedValues.join(`,${eol}` + gap) +
                `,${eol}` +
                mind +
                ']';
          gap = mind;
          level = startingLevel;
          arrayLevel--;
          return v;
        }

        let includeGaps = level <= 2;
        if (isNewFormat && arrayLevel > 0) {
          includeGaps = false;
        } else if (isNewFormat) {
          includeGaps = true;
        }

        const partial: string[] = [];
        Object.keys(value).forEach(function (k) {
          const v = stringify(k, value, [...pointer]);
          if (v) {
            partial.push(
              quote(k) + (includeGaps && !isNewFormat ? ': ' : ':') + v,
            );
          }
        });

        // Join all of the member texts together, separated with commas,
        // and wrap them in braces.

        // In the new format, the Channels object deep within a sprite has its keys newlined
        const needsLineBreak =
          isNewFormat &&
          (pointer.at(-1) === 'Channels' ||
            pointer.find((p) => p === 'ConfigValues'));

        const v =
          partial.length === 0
            ? '{}'
            : includeGaps || needsLineBreak
              ? `{${eol}` +
                gap +
                partial.join(`,${eol}` + gap) +
                `,${eol}` +
                mind +
                '}'
              : '{' + partial.join(',') + ',}';
        gap = mind;
        level = startingLevel;
        return v;
      }
    }
    return;
  }

  // If there is a replacer, it must be a function or an array.
  // Otherwise, throw an error.

  // Make a fake root object containing our value under the key of ''.
  // Return the result of stringifying the value.

  return stringify(
    '',
    {
      '': yyData,
    },
    [],
  );
}

interface StringifyPrepMeta {
  root: any;
  isNewFormat: boolean;
  path: (string | number)[];
}

/**
 * Get a clone of some yyData, ready for stringification
 * (keys in the right order, the right keys, etc)
 *
 * Sort keys GameMaker-style (which does change over time!).
 * For the new format (where the '%Name' key exists), sort order
 * is just alphabetical (case-insensitive).
 *
 * Prior to the new format, the final sort order was:
 * - "resourceType": "GMSprite",
 * - "resourceVersion": "1.0",
 * - "name": "barrel_tendraam",
 * - Everything else, in alphabetical order (case-insensitive).
 */
function prepareForStringification<T>(
  yyData: T,
  yyp?: Yyp,
  __meta: StringifyPrepMeta = { root: yyData, isNewFormat: false, path: [] },
): T {
  const ideVersion = yyp?.MetaData?.IDEVersion
    ? new GameMakerVersionString(yyp.MetaData.IDEVersion)
    : null;
  const isNewFormat =
    __meta.isNewFormat || yyIsNewFormat(yyData) || yyIsNewFormat(yyp);
  __meta = {
    ...__meta,
    isNewFormat,
    path: [...__meta.path],
  };
  if (Array.isArray(yyData)) {
    const prepared = yyData.map((item, i) => {
      const meta = { ...__meta, path: [...__meta.path, i] };
      return prepareForStringification(item, yyp, meta);
    }) as T;
    if (isNewFormat && '$GMProject' in __meta.root) {
      // Then we need to sort the resources, folders, and included files arrays
      const currentPath = __meta.path.join('/');
      if (currentPath === 'resources') {
        // Sort based on the path
        const resources = prepared as YypResource[];
        resources.sort((a, b) =>
          a.id.path.toLowerCase().localeCompare(b.id.path.toLowerCase()),
        );
      } else if (currentPath === 'IncludedFiles') {
        const includedFiles = prepared as Yyp['IncludedFiles'];
        includedFiles.sort((a, b) =>
          `${a.filePath}/${a.name}`
            .toLowerCase()
            .localeCompare(`${b.filePath}/${b.name}`.toLowerCase()),
        );
      } else if (currentPath === 'Folders') {
        const folders = prepared as Yyp['Folders'];
        folders.sort((a, b) =>
          a.folderPath.toLowerCase().localeCompare(b.folderPath.toLowerCase()),
        );
      }
    }

    return prepared;
  } else if (yyData instanceof FixedNumber) {
    return yyData;
  } else if (typeof yyData === 'object' && yyData !== null) {
    const yyDataCopy = { ...yyData } as Record<string, any>;
    const hasResourceType =
      'resourceType' in yyData && typeof yyData.resourceType === 'string';
    if (isNewFormat && hasResourceType) {
      // Then we need to ensure that the file has the `${resourceType}` key,
      // because we may be converting an old format to the new one.
      yyDataCopy[`$${yyData.resourceType}`] ||= '';
      if (
        yyDataCopy[`$${yyData.resourceType}`] === '' &&
        ['GMScript', 'GMRoom', 'GMRInstance', 'GMEvent'].includes(
          yyData.resourceType as string,
        ) &&
        ideVersion?.gte('2024.800.0.618')
      ) {
        // Then we need to set this to "v1" instead of ""
        yyDataCopy[`$${yyData.resourceType}`] = 'v1';
      }
    }
    if (
      isNewFormat &&
      'name' in yyData &&
      typeof yyData.name === 'string' &&
      hasResourceType && // Otherwise it's just a different kind of 'name' field
      !('$GMSpriteFramesTrack' in yyDataCopy) // Special case
    ) {
      // Then we need to ensure that the file has the `%Name` key,
      // because we may be converting an old format to the new one.
      // Since older code updates the 'name' field when and doesn't know
      // about the '%Name' field, the safest thing is to ALWAYS set
      // the '%Name' field to the 'name' field.
      yyDataCopy[nameField] = yyData.name;
    }
    if (isNewFormat && hasResourceType) {
      // Then there should always be a resourceVersion key with value "2.0"
      yyDataCopy['resourceVersion'] = '2.0';
    }

    if ('$GMSpriteFramesTrack' in yyDataCopy) {
      // Make sure it doesn't have a '%Name' key, since that causes build failures
      delete yyDataCopy[nameField];
    }
    const keys = Object.keys(yyDataCopy) as (keyof T)[] as string[];
    keys.sort((a, b) => {
      if (!isNewFormat && hasResourceType) {
        if (a === 'resourceType') {
          return -1;
        }
        if (b === 'resourceType') {
          return 1;
        }
        if (a === 'resourceVersion') {
          return -1;
        }
        if (b === 'resourceVersion') {
          return 1;
        }
        if (a === 'name') {
          return -1;
        }
        if (b === 'name') {
          return 1;
        }
      }
      if (a === b) return 0;
      // The GameMaker sort algorithm treats '_' as greater than all letters (no matter the case), so we have to force that behavior by replacing those chars with something that *actually* is (like `|`)
      a = a.toLowerCase();
      b = b.toLowerCase();
      if (isNewFormat) {
        a = a.replace(/_/g, '|');
        b = b.replace(/_/g, '|');
      }
      if (a < b) return -1;
      return 1;
    });
    // Delete each entry and re-add it in the sorted order.
    const reference = { ...yyDataCopy };
    keys.forEach((key) => delete yyDataCopy[key as string]);
    keys.forEach((key) => {
      const meta = { ...__meta, path: [...__meta.path, key] };
      yyDataCopy[key] = prepareForStringification(reference[key], yyp, meta);
    });
    return yyDataCopy as T;
  }

  return yyData;
}
