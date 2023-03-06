import fs from 'fs/promises';
import YAML from 'yaml';

const data = await fs.readFile(process.argv[2], 'utf8');
const json = YAML.parse(data);
await fs.writeFile(process.argv[3], JSON.stringify(json, null, 2));
