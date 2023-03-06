import { deleteAsync } from 'del';

await deleteAsync(['node_modules', '*/*/node_modules']);
