import fs from 'fs-extra';
import path from 'path';
export default fs.readJSONSync(path.join(__dirname,'../../../package.json')).version;
