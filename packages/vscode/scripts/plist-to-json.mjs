import { readFileSync, writeFileSync } from 'fs';
import plist from 'plist';

const data = readFileSync(process.argv[2], 'utf8');
const json = JSON.stringify(plist.parse(data), null, 2);
writeFileSync(process.argv[3], json);
