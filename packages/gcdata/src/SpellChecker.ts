import dictionary from 'dictionary-en';
import nspell from 'nspell';

export const checker = nspell(Buffer.from(dictionary.aff), Buffer.from(dictionary.dic));

