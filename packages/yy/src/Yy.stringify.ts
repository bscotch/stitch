import { GameMakerVersionString } from './types/GameMakerVersionString.ts';
import type { Yyp, YypResource } from './types/Yyp.ts';
import { isGameMakerFloatField } from './Yy.floats.ts';
import {
  formatGameMakerFloat,
  isObjectWithField,
  nameField,
  yyIsNewFormat,
} from './types/utility.ts';

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

const yypPathCollator = new Intl.Collator('en');

/**
 * The first GameMaker IDE versions known to have
 * specific project-file format changes.
 */
export const gameMakerVersions = {
  /** `$GMScript`, `$GMRoom`, `$GMRInstance`, and `$GMEvent` went from `""` to `"v1"` */
  v1Scripts: '2024.800.0.618',
  /** `$GMSound` went to `"v2"`, `$GMAudioGroup` to `"v1"` (both with an `exportDir` field) */
  v2Sounds: '2024.1400.0.815',
  /** `$GMSprite` went to `"v2"`, `$GMSpriteFrame` and `$GMSequence` to `"v1"` */
  v2Sprites: '2024.1400.0.904',
  /** Arrays of numbers inside of inlined objects are also inlined */
  inlinedNumberArrays: '2024.1400.0.904',
} as const;

/**
 * Compare two strings the way GameMaker does when sorting
 * resources, folders, and included files in the project file.
 *
 * Uses a fixed locale so that results don't depend on the
 * system locale (which, for example, puts CJK characters
 * before latin characters for Chinese locales).
 */
export function compareYypPaths(a: string, b: string): number {
  return yypPathCollator.compare(a.toLowerCase(), b.toLowerCase());
}

/**
 * Jsonify, with GameMaker-like JSON and allowing for BigInts.
 * Based on {@link https://github.com/sidorares/json-bigint/blob/master/lib/stringify.js json-bigint}.
 *
 * The yyp file can be passed in to use as a reference,
 * e.g. to ensure the right format is used for new files.
 */
export function stringifyYy(yyData: any, yyp?: Yyp): string {
  const isNewFormat = yyIsNewFormat(yyData) || yyIsNewFormat(yyp);
  const ideVersion = yyp?.MetaData?.IDEVersion
    ? new GameMakerVersionString(yyp.MetaData.IDEVersion)
    : null;
  /**
   * Whether or not number arrays inside of inlined
   * objects should also be inlined. If we don't know the
   * IDE version, assume the latest behavior.
   */
  const inlinesNumberArrays =
    isNewFormat &&
    (!ideVersion || ideVersion.gte(gameMakerVersions.inlinedNumberArrays));

  const eol = isNewFormat ? '\n' : `\r\n`;
  const rootResourceType: unknown = isObjectWithField(yyData, 'resourceType')
    ? yyData.resourceType
    : undefined;

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

    if (typeof value === 'number' && typeof key === 'string') {
      // The key of the parent object/array containing the holder
      const parentKey = pointer
        .slice(0, -1)
        .findLast((p): p is string => typeof p === 'string');
      if (isGameMakerFloatField(holder.resourceType, parentKey, key)) {
        return formatGameMakerFloat(value);
      }
    }

    // If the value has a toJSON method, call it to obtain a replacement value.
    // Only objects are allowed to do this: other code running in the same
    // process (e.g. another VSCode extension) may have patched
    // `BigInt.prototype.toJSON` to return a string, which would cause
    // integers like `-1` to be written as `"-1"`.
    if (
      value &&
      typeof value === 'object' &&
      typeof value.toJSON === 'function'
    ) {
      value = value.toJSON(key) ?? value;
    }

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

          // Since 2024.1400, arrays of numbers that are within
          // an inlined object (one nested inside of an array) are
          // also inlined, e.g. `"args":[1,2,],`
          const isInlinedNumberArray =
            inlinesNumberArrays &&
            arrayLevel > 1 &&
            value.every(
              (item) => typeof item === 'number' || typeof item === 'bigint',
            );

          // Join all of the elements together, separated with commas, and wrap them in
          // brackets.
          const v =
            jsonifiedValues.length === 0
              ? '[]'
              : isInlinedNumberArray
                ? `[${jsonifiedValues.join(',')},]`
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

        // In the new format, a font's glyphs (a dictionary keyed by
        // character code) has each glyph inlined.
        const isInlinedFontGlyph =
          isNewFormat &&
          rootResourceType === 'GMFont' &&
          pointer.length === 2 &&
          pointer[0] === 'glyphs';

        const v =
          partial.length === 0
            ? '{}'
            : (includeGaps || needsLineBreak) && !isInlinedFontGlyph
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

  // Apply GameMaker's own format upgrades, based on the IDE version
  // (Using an aliased variable so we can type it as unknown)
  const data: unknown = yyData;
  if (isYyOfType(data, 'GMScript', isNewFormat)) {
    if (ideVersion?.gte(gameMakerVersions.v1Scripts)) {
      // Then we need to set this to "v1" instead of ""
      data[`$GMScript`] = 'v1';
    }
  } else if (isYyOfType(data, 'GMSound', isNewFormat)) {
    if (ideVersion?.gte(gameMakerVersions.v2Sounds)) {
      data['$GMSound'] = 'v2';
      // The 'type' field has been replaced with 'channelFormat'.
      // (Note that 0 is a valid value for both!)
      data['channelFormat'] ??= data['type'] ?? 1;
      data['compressionQuality'] ??= 4;
      data['exportDir'] ??= '';
      delete data.type;
      delete data.bitRate;
    }
  } else if (isYyOfType(data, 'GMAudioGroup', isNewFormat)) {
    if (ideVersion?.gte(gameMakerVersions.v2Sounds)) {
      data['$GMAudioGroup'] = 'v1';
      data['exportDir'] ??= '';
    }
  } else if (isYyOfType(data, 'GMSprite', isNewFormat)) {
    if (ideVersion?.gte(gameMakerVersions.v2Sprites)) {
      // GameMaker upgrades sprites by changing their
      // version strings (and nothing else).
      data['$GMSprite'] = 'v2';
      const frames: unknown[] = Array.isArray(data.frames) ? data.frames : [];
      for (const frame of frames) {
        if (isYyOfType(frame, 'GMSpriteFrame', isNewFormat)) {
          frame['$GMSpriteFrame'] = 'v1';
        }
      }
      const sequence: unknown = data.sequence;
      if (isYyOfType(sequence, 'GMSequence', isNewFormat)) {
        sequence['$GMSequence'] = 'v1';
      }
    }
  }
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
        resources.sort((a, b) => compareYypPaths(a.id.path, b.id.path));
      } else if (currentPath === 'IncludedFiles') {
        const includedFiles = prepared as Yyp['IncludedFiles'];
        includedFiles.sort((a, b) =>
          compareYypPaths(`${a.filePath}/${a.name}`, `${b.filePath}/${b.name}`),
        );
      } else if (currentPath === 'Folders') {
        const folders = prepared as Yyp['Folders'];
        folders.sort((a, b) => compareYypPaths(a.folderPath, b.folderPath));
      }
    }

    return prepared;
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
        ideVersion?.gte(gameMakerVersions.v1Scripts)
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

/**
 * Whether some yyData represents a GameMaker resource of the
 * given type. In the new (2023+) format, checks both for the
 * `$${resourceType}` key and for the `resourceType` field, since
 * newly created data may not have the former yet.
 */
function isYyOfType(
  yyData: unknown,
  resourceType: string,
  isNewFormat: boolean,
): yyData is Record<string, any> {
  if (isObjectWithField(yyData, `$${resourceType}`)) return true;
  return (
    isNewFormat &&
    isObjectWithField(yyData, 'resourceType') &&
    yyData.resourceType === resourceType
  );
}
