import { pathy } from '@bscotch/pathy';
import { assert } from 'chai';
import { Project } from './project.js';

export async function resetSandbox() {
  for (const dir of ['target']) {
    const srcDir = pathy('samples').join(dir);
    const destDir = pathy('sandbox').join(dir);
    await destDir.rm({ recursive: true, maxRetries: 5 });
    await destDir.ensureDir();
    await srcDir.copy(destDir);
  }

  const targetProject = await Project.initialize('sandbox/target');
  assert(targetProject);
  return targetProject;
}
