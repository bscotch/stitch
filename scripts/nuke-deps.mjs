import { removeGlobs } from './clean.mjs';

await removeGlobs(['node_modules', '*/*/node_modules']);
