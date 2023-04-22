import { generateCstDts } from 'chevrotain';
import { writeFile } from 'node:fs/promises';
import { GmlParser } from '../dist/parser.js';

const parser = new GmlParser();

const productions = parser.getGAstProductions();

const dts = generateCstDts(productions, {
  includeVisitorInterface: true,
  visitorInterfaceName: 'GmlVisitor',
});

await writeFile('gml-cst.d.ts', dts);
