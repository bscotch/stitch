import fs from 'node:fs/promises';
import { GameChanger, Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import { objectToMap } from './util.js';

describe('Packed data', function () {
  it('can load packed data', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');

    const motes = objectToMap(packed.working.motes);
    assert(motes.size > 0, 'Packed data should have motes');

    const schemas = objectToMap(packed.working.schemas);
    assert(schemas.size > 0, 'Packed data should have schemas');
  });

  it('can find all l10n strings', async function () {
    const strings = new Map<string, string>();
    let wordCount = 0;
    let charCount = 0;
    const data = JSON.parse(
      await fs.readFile(
        `../../../crashlands-2/Crashlands2/datafiles/GameData/gamechanger.json`,
        'utf8',
      ),
    );
    const packed = new Gcdata(data);
    assert(packed, 'Packed data should be loaded');
    const motes = packed.listMotes();
    assert(motes.length > 0, 'Packed data should have motes');
    for (const mote of motes) {
      packed.visitMoteData(
        mote,
        (ctx) => {
          const subschema = ctx.current.subschema;
          if ('format' in subschema && subschema.format === 'l10n') {
            const text = ctx.current.data.text;
            charCount += text.length;
            wordCount += text.split(/[\s-]+/).length;
            assert(text, 'L10n string should have text');
            strings.set(ctx.current.pointer.join('/'), text);
          }
        },
        strings,
      );
    }
    console.log('Total L10n strings', strings.size);
    console.log('Total words', wordCount);
    console.log('Total chars', charCount);
  });
});
