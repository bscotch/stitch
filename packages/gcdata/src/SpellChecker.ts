import dictionary from 'dictionary-en';
import nspell from 'nspell';
import type { GameChanger } from './GameChanger.js';
import { normalizePointer, resolvePointerInSchema } from './util.js';

export class SpellChecker {
  protected checker = nspell(
    Buffer.from(dictionary.aff),
    Buffer.from(dictionary.dic),
  );

  constructor(
    public readonly gameChanger: GameChanger,
    protected options: {
      /** Motes with these schema IDs will not have their names added to the dictionary */
      skipSchemas?: string[];
    } = {},
  ) {
    this.reload();
  }

  reload() {
    this.checker = nspell(
      Buffer.from(dictionary.aff),
      Buffer.from(dictionary.dic),
    );
    const words = this.listMoteNameWords();
    console.log(JSON.stringify(words, null, 2), words.length);
  }

  /** Get the list of localized Mote Names, broken into "words" for use in the dictionary. */
  protected listMoteNameWords() {
    const names: string[] = [];

    // Find all mote names that are meant to be localized, and
    // add those names to the spell checker.
    const motes = this.gameChanger.working.listMotes();
    for (const mote of motes) {
      if (this.options.skipSchemas?.includes(mote.schema_id)) continue;
      const schema = this.gameChanger.working.getSchema(mote.schema_id);
      const namePointer = schema?.name;
      if (!schema || !namePointer) continue;
      // Need to check one level up to see if this is an L10n field.
      const parentPointer = normalizePointer(namePointer);
      parentPointer.pop();
      const nameSchema = resolvePointerInSchema(
        parentPointer,
        mote,
        this.gameChanger.working,
      );
      if (
        nameSchema &&
        'format' in nameSchema &&
        nameSchema.format === 'l10n' &&
        !mote.data.wip?.draft
      ) {
        names.push(this.gameChanger.working.getMoteName(mote.id)!);
      }
    }

    const words = new Set<string>();
    for (const name of names) {
      const parts = name.trim().split(/\s+/g);
      for (let part of parts) {
        // Remove any apostrophes
        part = part.replace(/'.*/g, '');
        // Remove any trailing punctuation
        part = part.replace(/\s*[!?)\]-]+$/g, '');
        // Remove any leading punctuation
        part = part.replace(/^[!?([-]+\s*/g, '');

        const skip =
          part.length < 2 ||
          part.match(/^\d+|\d+x\d+|.*\/.*$/) ||
          this.checker.correct(part);
        if (!skip) {
          words.add(part);
        }
      }
    }
    // Sort by lower-case
    return [...words].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }
}
