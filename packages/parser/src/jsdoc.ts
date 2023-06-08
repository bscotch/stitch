import { keysOf } from '@bscotch/utility';

const patterns = {
  paramTag: `@(param(eter)?|arg(ument)?)\\b`,
  descriptionTag: `@desc(ription)?\\b`,
  functionTag: `@func(tion)?\\b`,
  returnTag: `@returns?\\b`,
  pureTag: `@pure\\b`,
  ignoreTag: `@ignore\\b`,
  deprecatedTag: `@deprecated\\b`,
  selfTag: `@(context|self)\\b`,
  typeTag: `@type\\b`,
  unknownTag: `@[a-zA-Z]+\\b`,
};
const typeGroupPattern = `(?<typeGroup>{\\s*(?<typeUnion>[^}]*?)?\\s*})`;

const names = keysOf(patterns);
for (const tagName of names) {
  // Add the line prefix
  patterns[tagName] = `^(\\s*(?<delim>///|\\*)\\s*)?${patterns[tagName]}`;
}

// Types with required typeGroups
const typeTags = ['returnTag', 'typeTag'] as const;
for (const tagName of typeTags) {
  patterns[tagName] = `${patterns[tagName]}\\s*${typeGroupPattern}`;
}

// Params
patterns.paramTag = `${patterns.paramTag}(\\s+${typeGroupPattern})?(?<name>[a-zA-Z_]+)`;
// Self (has a type but no group)
patterns.selfTag = `${patterns.selfTag}\\s+(?<type>[a-zA-Z_.]+)`;

// Descriptions
for (const tagName of ['descriptionTag', 'returnTag', 'paramTag'] as const) {
  patterns[tagName] = `${patterns[tagName]}\\s+(?<description>.*)$`;
}

const regexes: Record<(typeof names)[number], RegExp> = names.reduce(
  (acc, tagName) => {
    acc[tagName] = new RegExp(patterns[tagName], 'd');
    return acc;
  },
  {} as any,
);

export function parseJsdocString(jsdocString: string) {
  const lines = jsdocString.split(/\r?\n/);
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    for (const tagName of names) {
      const match = line.match(regexes[tagName]) as RegExpMatchArray | null;
      if (!match) continue;
      const { groups } = match;
      break;
    }
  }
}

function joinPatterns(patterns: (RegExp | string)[]) {
  return new RegExp(
    patterns.map((p) => (typeof p === 'string' ? p : p.source)).join(''),
  );
}
