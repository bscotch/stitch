import fs from 'fs/promises';
import YAML from 'yaml';

const data = await fs.readFile(process.argv[2], 'utf8');
const json = JSON.parse(data);
await fs.writeFile(process.argv[3], YAML.stringify(json));
