import crypto from 'node:crypto';

export function computeChecksum(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
