import { assert } from './assert.js';
import { CreditsMote } from './cl2.shared.types.js';
import type { GameChanger } from './GameChanger.js';
import { bsArrayToArray } from './helpers.js';

export function stringifyCredits(
  mote: CreditsMote,
  packed: GameChanger,
): string {
  const blocks: string[] = [];

  // Have each section appear as a Markdown-style # header,
  // with its elementId as a prefix
  if (mote.data.sections) {
    for (const section of bsArrayToArray(mote.data.sections)) {
      const sectionId = section.id;
      const sectionName = section.element.name.text;
      blocks.push(`#${sectionId} ${sectionName}`);

      // Each entry could either be a single credit or a credits group, but lets represent them the same in either case:
      // For each *role*, tab in once and have `\t#<roleId> <roleName>`, followed by a newline, followed by `\t-<Credit Name>`
      // When we parse this we can then use singletons for entries
      // with only one person

      for (const entry of bsArrayToArray(section.element.entries)) {
        const entryId = entry.id;
        const element = entry.element;
        if (element.type === 'Gap') {
          // Gaps are not supported
          continue;
        }
        // Roles aren't strictly required (e.g. in cases where the section and role are the same)
        blocks.push(`\t#${entryId} ${element.role?.text ?? '???'}`);
        if (element.type === 'Single Entry') {
          assert(element.name.name, `Entry must have a name`);
          blocks.push(`\t- ${element.name.name}`);
        } else {
          for (const person of bsArrayToArray(element.names)) {
            assert(person.element?.name, `Entry must have a name`);
            blocks.push(`\t- ${person.element.name}`);
          }
        }
        blocks.push('');
      }

      blocks.push('');
    }
  }

  return blocks.join('\n');
}
