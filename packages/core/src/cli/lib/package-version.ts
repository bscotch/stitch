import { getModuleDir } from '@bscotch/utility';
import fs from 'fs-extra';
import path from 'path';
export default fs.readJSONSync(
  path.join(getModuleDir(import.meta), '../../../package.json'),
).version;
