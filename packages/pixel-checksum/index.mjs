import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const nativeModule = require('./index.node');
export const { computePngChecksum, computePngChecksums } = nativeModule;
