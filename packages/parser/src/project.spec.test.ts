import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { gmlSpecSchema, parseGmlSpecXml } from './project.spec.ts';

describe('GmlSpec XML parsing', function () {
  it('produces the expected object shape', function () {
    const xml = `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<Root xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" A="1">
  <Functions>
    <Function Name="f" Pure="true">
      <Description>Does   a
        thing &amp; more</Description>
      <Parameter Name="x" Optional="false">the  x</Parameter>
      <Parameter Name="y" Optional="true"/>
    </Function>
  </Functions>
  <Empty/>
  <Blank>   </Blank>
</Root>`;
    assert.deepStrictEqual(parseGmlSpecXml(xml), {
      // The root element is not wrapped in an array
      Root: {
        $: {
          'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          A: '1',
        },
        // All other elements are, even when there's only one
        Functions: [
          {
            Function: [
              {
                $: { Name: 'f', Pure: 'true' },
                // Text-only elements are strings, with whitespace runs collapsed
                Description: ['Does a thing & more'],
                Parameter: [
                  // Text alongside attributes goes under `_`
                  { _: 'the x', $: { Name: 'x', Optional: 'false' } },
                  { $: { Name: 'y', Optional: 'true' } },
                ],
              },
            ],
          },
        ],
        // Empty elements are empty objects
        Empty: [{}],
        Blank: [{}],
      },
    });
  });

  it('can parse the bundled GmlSpec', async function () {
    const raw = await readFile(
      new URL('../assets/GmlSpec.xml', import.meta.url),
      'utf8',
    );
    const spec = gmlSpecSchema.parse(parseGmlSpecXml(raw));
    assert.ok(spec.functions.length > 1000);
    assert.ok(spec.variables.length > 100);
    assert.ok(spec.constants.length > 500);
    const drawSprite = spec.functions.find((f) => f.name === 'draw_sprite');
    assert.ok(drawSprite);
    assert.equal(drawSprite.parameters.length, 4);
    assert.equal(drawSprite.parameters[0].name, 'sprite');
  });
});
