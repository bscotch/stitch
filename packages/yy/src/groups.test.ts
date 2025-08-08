import { ensureGroups } from './groups.js';
import { joinPaths } from './types/utility.js';

const projectPath = '../../../crashlands-2/Crashlands2';
const yypPath = joinPaths(projectPath, 'Crashlands2.yyp');

describe.skip('Groups', function () {
  it('can ensure audio and texture groups exist', async () => {
    // Create a bunch of random names by sticking a random integer after a prefix
    const names = Array.from(
      { length: 5 },
      (_, i) => `test_group_${i}_${Math.floor(Math.random() * 1000)}`,
    );
    await ensureGroups(
      yypPath,
      'audio',
      names.map((name) => `audio_${name}`),
    );
    await ensureGroups(
      yypPath,
      'texture',
      names.map((name) => `texture_${name}`),
    );
  });
});
