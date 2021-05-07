import http from 'http';
import https from 'https';
import fs from 'fs-extra';
import Url from 'url';
import { StitchError } from './errors';
import unzipper from 'unzipper';
import path from 'path';
import { logInfo } from './log';

interface GetResponse {
  contentType: string;
  data: any;
}

export function get(
  url: string,
  headers?: { [key: string]: string | undefined },
): Promise<GetResponse> {
  const { protocol } = Url.parse(url);
  const httpType = protocol?.match(/^(https?):$/)?.[1] as
    | 'http'
    | 'https'
    | null;
  if (!httpType) {
    throw new StitchError('URL must include protocol (http(s))');
  }
  return new Promise((resolve, reject) => {
    const getter = { http, https }[httpType];
    const options: https.RequestOptions & {
      headers: { [key: string]: any };
    } = { headers: headers || {} };
    options.headers['User-Agent'] = 'Bscotch Stitch';
    getter
      .get(url, options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          const status = res.statusCode || 500;
          if (status > 300 && status < 400) {
            // Then is probably a redirect
            if (!res.headers.location) {
              throw new StitchError(
                `Got status ${status} but no location header for redirect.`,
              );
            }
            return resolve(get(res.headers.location));
          }
          if (status > 399) {
            throw new StitchError(
              `Got non-200 response code ${status} when trying to download ${url}`,
            );
          }
          const contentType = res.headers['content-type'];
          const data = Buffer.concat(chunks);
          const response: GetResponse = {
            contentType: contentType || 'application/octet-stream',
            data,
          };
          if (contentType?.startsWith('text')) {
            response.data = data.toString('utf8');
            return resolve(response);
          } else if (contentType?.startsWith('application/json')) {
            try {
              response.data = JSON.parse(data.toString('utf8'));
              return resolve(response);
            } catch {
              throw new StitchError(
                `Response from ${url} was invalid JSON: ${data.toString(
                  'utf8',
                )}`,
              );
            }
          }
          return resolve(response);
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

/**
 * Downloads and unzip a remote zip file, returning the root path
 * to the unzipped contents.
 */
export async function unzipRemote(
  url: string,
  toDir: string,
  headers?: { [header: string]: any },
) {
  const { pathname } = Url.parse(url);
  if (!pathname?.endsWith('.zip')) {
    throw new StitchError(`Expected URL to Zip file to end with '.zip'.`);
  }
  fs.ensureDirSync(toDir);
  if (fs.readdirSync(toDir).length > 0) {
    throw new StitchError(`Output directory ${toDir} is not empty.`);
  }
  logInfo('Downloading...');
  const response = await get(url, headers);
  if (!response.contentType.includes('zip')) {
    throw new StitchError(
      `Expected downloaded content-type to included 'zip', got ${response.contentType}.`,
    );
  }
  logInfo('Unzipping...');
  const zipDir = await unzipper.Open.buffer(response.data);
  await zipDir.extract({ concurrency: 10, path: toDir });
  logInfo('Unzipped!');
  return path.join(toDir, zipDir.files[0].path);
}
