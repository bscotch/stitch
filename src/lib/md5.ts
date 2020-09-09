import crypto, { HexBase64BinaryEncoding } from "crypto";

/** Create an MD5 hash (as base64 by default) */
export function md5(content:string|Buffer,encoding:HexBase64BinaryEncoding='base64'){
  return crypto
    .createHash('md5')
    .update(content)
    .digest('base64');
}
