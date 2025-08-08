import { assert } from './types/utility.js';
import { Yy } from './Yy.js';

/**
 * Ensure the provided audio or texture groups exist in the YYP file.
 * If they already exist, no operation will be performed.
 */
export async function ensureGroups(
  yypPath: string,
  kind: 'audio' | 'texture',
  names: string[],
): Promise<{ result: 'created' | 'noop' }> {
  let result: 'created' | 'noop' = 'noop';
  assert(
    yypPath.endsWith('.yyp'),
    'First argument must be a path to a .yyp file',
  );
  names = [...new Set(names)]; // ensure uniqueness

  const yyp = await Yy.read(yypPath, 'project');
  const currentGroups = kind === 'audio' ? yyp.AudioGroups : yyp.TextureGroups;

  for (const newName of names) {
    const existing = currentGroups.find((group) => group.name === newName);
    if (existing) continue;
    result = 'created';
    // @ts-expect-error Will get fixed up on save!
    currentGroups.push({ name: newName });
  }

  if (result === 'created') {
    await Yy.write(yypPath, yyp, 'project');
  }
  return { result };
}
