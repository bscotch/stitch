import { Pathy } from '@bscotch/pathy';
import crypto from 'crypto';
import fs from 'fs';
import { Logger } from '@bscotch/utility';

export const logger = new Logger();

export function fileChecksum(path: Pathy | string): Promise<string> {
  return new Promise(function (resolve, reject) {
    // crypto.createHash('sha1');
    // crypto.createHash('sha256');
    const hash = crypto.createHash('md5');
    const input = fs.createReadStream(path.toString());

    input.on('error', reject);

    input.on('data', function (chunk) {
      hash.update(chunk);
    });

    input.on('close', function () {
      resolve(hash.digest('base64'));
    });
  });
}
