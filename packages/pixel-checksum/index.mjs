import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const nativeModule = require('./pixel-checksum.node');
export const { computePngChecksum, computePngChecksums } = nativeModule;
