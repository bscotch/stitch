import { readFile } from 'fs/promises';
import { parseStringPromise } from 'xml2js';
import { GmlSpec, gmlSpecSchema } from './spec.schemas.js';
export type { GmlSpec } from './spec.schemas.js';

// @ts-expect-error
import fallbackSpec from '../samples/GmlSpec.xml';

export async function parseSpec(specFilePath?: string): Promise<GmlSpec> {
  const specRaw = specFilePath
    ? await readFile(specFilePath, 'utf8')
    : (fallbackSpec as string);
  const asJson = await parseStringPromise(specRaw);
  return gmlSpecSchema.parse(asJson);
}
