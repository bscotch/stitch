import fs from 'fs/promises';

/**
 * @template T
 * @param {string} path
 * @param {import('zod').ZodSchema<T>} [schema]
 * @returns {Promise<T>}
 */
export async function readJson(path, schema) {
  const content = await fs.readFile(path, 'utf8');
  const parsed = JSON.parse(content);
  return schema ? schema.parse(parsed) : parsed;
}
